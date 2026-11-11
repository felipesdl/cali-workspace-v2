import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '../../../components/ds/field/Controls';
import { Field } from '../../../components/ds/field/Field';
import { FeedbackState } from '../../../components/ds/feedback/FeedbackState';
import { faq } from './faq-content';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');

export function ClientFaqPage() {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const term = normalize(query.trim());
  const groups = faq
    .map(({ topic, items }) => ({
      topic,
      items: items.filter(([question, answer]) =>
        normalize(`${question} ${answer}`).includes(term),
      ),
    }))
    .filter(({ items }) => items.length);

  return (
    <div className="tw:grid tw:gap-4">
      <p>Entenda as horas contratadas, os avisos de consumo e os excedentes.</p>
      <Field id="faq-search" label="Buscar nas dúvidas frequentes">
        <Input
          id="faq-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Ex.: excedente"
        />
      </Field>
      {!groups.length && (
        <FeedbackState kind="empty">
          Nenhuma pergunta encontrada. Fale com a CALI pelas Ocorrências.
        </FeedbackState>
      )}
      {groups.map(({ topic, items }) => (
        <section
          key={topic}
          className="tw:min-w-0 tw:rounded-control tw:border tw:border-border-default tw:bg-panel tw:p-4"
        >
          <h2 className="tw:mt-0 tw:text-section tw:text-brand">{topic}</h2>
          {items.map(([question, answer], index) => {
            const expanded = Boolean(term) || openQuestion === question;
            const answerId = `faq-answer-${faq.findIndex((group) => group.topic === topic)}-${index}`;
            return (
              <div key={question} className="tw:border-t tw:border-border-default tw:py-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={answerId}
                  className="tw:flex tw:min-h-11 tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:bg-transparent tw:p-0 tw:text-left tw:font-semibold tw:text-copy"
                  onClick={() =>
                    setOpenQuestion((current) => (current === question ? null : question))
                  }
                >
                  <span>{question}</span>
                  {expanded ? (
                    <ChevronDown
                      aria-hidden="true"
                      className="tw:shrink-0 tw:text-brand"
                      size={16}
                    />
                  ) : (
                    <ChevronRight
                      aria-hidden="true"
                      className="tw:shrink-0 tw:text-brand"
                      size={16}
                    />
                  )}
                </button>
                <p
                  id={answerId}
                  hidden={!expanded}
                  className="tw:mt-2 tw:mb-0 tw:max-w-prose tw:text-muted-copy"
                >
                  {answer}
                </p>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
