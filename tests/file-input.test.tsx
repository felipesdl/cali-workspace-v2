import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Field } from '../src/components/ds/field/Field';
import { FileInput } from '../src/components/ds/field/FileInput';

it('reflete os nomes da seleção múltipla e volta ao estado vazio quando ela é limpa', async () => {
  const user = userEvent.setup();
  render(
    <form aria-label="Anexos">
      <Field id="attachments" label="Anexos PDF">
        <FileInput id="attachments" name="pdf" accept=".pdf" multiple required />
      </Field>
    </form>,
  );
  const input = screen.getByLabelText<HTMLInputElement>('Anexos PDF');
  expect(input.validity.valueMissing).toBe(true);
  const files = ['contrato.pdf', 'aditivo.pdf'].map(
    (name) => new File(['%PDF-'], name, { type: 'application/pdf' }),
  );
  await user.upload(input, files);
  expect(screen.getByText('contrato.pdf, aditivo.pdf')).toBeTruthy();
  expect(Array.from(input.files ?? [])).toEqual(files);

  await user.upload(input, []);
  expect(screen.getByText('Nenhum arquivo selecionado')).toBeTruthy();
});
