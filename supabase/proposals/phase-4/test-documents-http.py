#!/usr/bin/env python3
"""Prova HTTP privada com JWTs sintéticos. Imagens em cache, rede interna e sem portas publicadas."""
import base64
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parent
POSTGRES = 'public.ecr.aws/supabase/postgres:17.11.0.006'
POSTGREST = 'public.ecr.aws/supabase/postgrest:v16.5'
PREFIX = 'cali-phase4-http-' + secrets.token_hex(4)
DB = PREFIX + '-db'
REST = PREFIX + '-rest'
KEY = secrets.token_hex(32)
A = '9c5ab148-78b8-4410-9338-58c44222a5db'
B = '6f8b1d03-e4ee-4a2b-a766-8a8f96cd2d76'


def docker(*args, stdin=None, check=True):
    return subprocess.run(['docker', *args], input=stdin, text=True, capture_output=True, check=check)


def expand(path):
    return '\n'.join(
        expand((path.parent / line.split()[1]).resolve()) if line.startswith('\\ir ') else line
        for line in path.read_text().splitlines()
    )


def token(number, assurance):
    def encoded(data):
        return base64.urlsafe_b64encode(data).decode().rstrip('=')
    header = encoded(b'{"alg":"HS256","typ":"JWT"}')
    body = encoded(json.dumps({
        'role': 'authenticated',
        'sub': f'00000000-0000-4000-8000-{number:012}',
        'aal': assurance,
        'exp': int(time.time()) + 300,
    }).encode())
    unsigned = f'{header}.{body}'
    signature = encoded(hmac.new(KEY.encode(), unsigned.encode(), hashlib.sha256).digest())
    return f'{unsigned}.{signature}'


def rpc(name, args, jwt=None):
    options = ['-H', 'Authorization: Bearer ' + jwt] if jwt else []
    output = docker(
        'exec', '-i', DB, 'curl', '-sS', '--max-time', '10', '-i', '-X', 'POST',
        '-H', 'Content-Type: application/json', *options, '--data-binary', '@-',
        f'http://{REST}:3000/rpc/{name}', stdin=json.dumps(args),
    ).stdout
    headers, _, body = output.partition('\n\n')
    return int(headers.splitlines()[0].split()[1]), headers.lower(), json.loads(body)


def check(label, expected, result):
    code, headers, body = result
    if code != expected:
        raise RuntimeError(f'{label}: HTTP {code}, esperado {expected}')
    return headers, body


def wait(label, predicate):
    for _ in range(60):
        if predicate():
            return
        time.sleep(0.5)
    raise RuntimeError(f'{label} indisponível')


def main():
    docker('network', 'create', '--internal', PREFIX)
    try:
        docker('run', '-d', '--pull=never', '--network', PREFIX, '--name', DB, '--user', 'postgres',
               '--entrypoint', '/bin/sh', POSTGRES, '-ec',
               "initdb -D /tmp/phase4 --auth=trust >/dev/null "
               "&& echo 'host postgres phase4_http all trust' >> /tmp/phase4/pg_hba.conf "
               "&& exec postgres -D /tmp/phase4 -c listen_addresses='*'")
        wait('PostgreSQL', lambda: docker('exec', DB, 'pg_isready', '-U', 'postgres', check=False).returncode == 0)
        sql = '\n'.join(expand(ROOT / name) for name in (
            '../../../tests/fixtures/phase4/write-context.sql',
            'pilot-role.sql', 'project-operations.sql', 'document-operations.sql',
        ))
        sql += """
create or replace function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
create role phase4_http login noinherit;
grant anon,authenticated to phase4_http;
grant usage on schema cali_workspace to anon;
"""
        prepared = docker('exec', '-i', DB, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', stdin=sql, check=False)
        if prepared.returncode != 0:
            raise RuntimeError('Falha ao preparar fixture HTTP: ' + prepared.stderr)
        docker('run', '-d', '--pull=never', '--network', PREFIX, '--name', REST,
               '-e', f'PGRST_DB_URI=postgres://phase4_http@{DB}/postgres',
               '-e', 'PGRST_DB_SCHEMAS=cali_workspace',
               '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', f'PGRST_JWT_SECRET={KEY}', POSTGREST)
        try:
            wait('PostgREST', lambda: docker('exec', DB, 'curl', '-fsS', '--max-time', '2',
                 f'http://{REST}:3000/', check=False).returncode == 0)
        except RuntimeError:
            logs = docker('logs', '--tail', '8', REST, check=False)
            raise RuntimeError('PostgREST indisponível: ' + (logs.stdout + logs.stderr).replace(KEY, '[redigido]')) from None
        admin, low_admin, client_a, client_b = (
            token(14, 'aal2'), token(14, 'aal1'), token(11, 'aal1'), token(12, 'aal1')
        )
        doc, revision, second = (str(uuid.uuid4()) for _ in range(3))
        scope = dict(p_company_id=A, p_document_id=doc)
        first_bytes = b'%PDF-1.4\nfixture A\n'
        second_bytes = b'%PDF-1.4\nfixture B\n'
        upload = dict(**scope, p_revision_id=revision, p_expected_latest=None, p_title='PDF sintético',
                      p_file_name='qa.pdf', p_pdf_base64=base64.b64encode(first_bytes).decode())
        download = dict(**scope, p_revision_id=revision)
        check('Upload sem MFA', 403, rpc('v2_add_pilot_document_revision', upload, low_admin))
        check('Upload Admin', 200, rpc('v2_add_pilot_document_revision', upload, admin))
        check('Rascunho', 403, rpc('v2_read_pilot_document_pdf', download, client_a))
        check('Publicação', 200, rpc('v2_set_pilot_document_publication',
              dict(**scope, p_expected_published=None, p_next_revision=revision), admin))
        check('Acesso anônimo', 401, rpc('v2_read_pilot_document_pdf', download))
        check('Outra empresa', 403, rpc('v2_read_pilot_document_pdf', dict(download, p_company_id=B), client_b))
        headers, body = check('Download permitido', 200, rpc('v2_read_pilot_document_pdf', download, client_a))
        if 'cache-control: private, no-store' not in headers or base64.b64decode(body['content']) != first_bytes:
            raise RuntimeError('Resposta HTTP diverge dos bytes ou da política de cache esperada')
        check('Ciência', 200, rpc('v2_ack_pilot_document', download, client_a))
        check('Nova revisão', 200, rpc('v2_add_pilot_document_revision',
              dict(upload, p_revision_id=second, p_expected_latest=revision,
                   p_pdf_base64=base64.b64encode(second_bytes).decode()), admin))
        check('Substituição', 200, rpc('v2_set_pilot_document_publication',
              dict(**scope, p_expected_published=revision, p_next_revision=second), admin))
        check('Revisão anterior', 403, rpc('v2_read_pilot_document_pdf', download, client_a))
        check('Retirada', 200, rpc('v2_set_pilot_document_publication',
              dict(**scope, p_expected_published=second, p_next_revision=None), admin))
        check('Revisão retirada', 403, rpc('v2_read_pilot_document_pdf',
              dict(**scope, p_revision_id=second), client_a))
        print('13 verificações HTTP passaram com JWTs sintéticos e Cache-Control private, no-store.')
    finally:
        docker('rm', '-f', '-v', REST, DB, check=False)
        docker('network', 'rm', PREFIX, check=False)


if __name__ == '__main__':
    main()
