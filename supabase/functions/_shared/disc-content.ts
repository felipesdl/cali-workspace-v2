/* Perfil Comportamental CALI — textos dos relatórios (v1.1, após o parecer de 23/10/2026; rascunho para revisão da proprietária).
   Um texto por perfil, usado no relatório do respondente (2ª pessoa, acolhedor) e no do avaliador (descritivo, orientado a decisão).
   Cada força tem dono (um estilo) e um comportamento que terceiros reconhecem. Temperamento entra só como vocabulário, nunca como nota.
   Cores: cartela DISC (D vermelho, I amarelo, S verde, C azul). `color` pinta barras e marcas; `ink` é a versão legível para texto. */
export type Style = 'D' | 'I' | 'S' | 'C';

export type StyleContent = {
  name: string;
  verb: string;
  verbLine: string;
  oneLiner: string;
  firstMove: string;
  color: string;
  ink: string;
  soft: string;
  character: string;
  temperament: string;
  temperamentWords: string;
  respondent: {
    summary: string;
    strengths: Array<{ title: string; example: string }>;
    contextStrength: { title: string; text: string };
    cost: string;
    perceived: string;
    attention: { name: string; text: string; signal: string };
    decides: string;
    communicates: string;
    reacts: string;
    energy: string[];
    drains: string[];
    thrives: { ambiente: string; lideranca: string; rotina: string; reconhecimento: string };
    plan: Array<{ scenario: string; action: string; question: string }>;
  };
  evaluator: {
    synthesis: string;
    roleFavors: string[];
    roleNeedsSupport: string[];
    costly: string;
    lead: {
      comunicacao: string;
      delegacao: string;
      feedback: string;
      reconhecimento: string;
      evitar: string;
    };
    risks: Array<{ risk: string; signal: string }>;
    interview: Array<{ question: string; confirms: string; denies: string }>;
    ceo: Array<{ reflection: string; ask: string }>;
    teamConcentrated: string;
    teamMissing: string;
  };
  bandHigh: string;
  bandLow: string;
  pressureUp: string;
  pressureDown: string;
  /** Dica prática para a semana difícil, conforme o estilo sobe ou desce sob pressão (relatório do respondente). */
  pressureTipUp: string;
  pressureTipDown: string;
  /** Que apoio pedir na semana difícil (relatório do respondente). */
  askForHelp: string;
};

export const STYLE_CONTENT: Record<Style, StyleContent> = {
  D: {
    name: 'Executor',
    verb: 'resolve',
    verbLine: 'Resolve: decide, assume a frente e puxa o resultado.',
    oneLiner: 'Resolve. Decide com pouca informação e gosta de desafio.',
    firstMove: 'Agir, mesmo sem plano completo.',
    color: '#E03A3E',
    ink: '#B3261E',
    soft: '#FCE6E6',
    character: '/brand/disc-d.png',
    temperament: 'Colérico',
    temperamentWords: 'direto, intenso, competitivo, impaciente com demora',
    respondent: {
      summary:
        'No dia a dia, você tende a ir direto ao ponto e a puxar a decisão para si quando as coisas param. Gosta de ver resultado acontecendo e se sente bem quando tem autonomia para resolver do seu jeito.',
      strengths: [
        {
          title: 'Decisão quando trava',
          example:
            'Quando a reunião termina sem definição, é você quem propõe o próximo passo e um responsável.',
        },
        {
          title: 'Foco no que precisa sair',
          example:
            'Em semana cheia, você define o que entrega primeiro e corta o que pode esperar.',
        },
      ],
      contextStrength: {
        title: 'Firmeza quando é preciso',
        text: 'Mesmo sem ser o seu jeito principal, você consegue assumir a frente e decidir quando ninguém decide.',
      },
      cost: 'A mesma velocidade que destrava pode atropelar quem precisa de mais tempo ou de mais contexto.',
      perceived:
        'Quem trabalha com você costuma ver alguém que assume responsabilidade, destrava as coisas e não foge de conversa difícil.',
      attention: {
        name: 'Pressa que atropela',
        text: 'Quando a velocidade vira prioridade, outras pessoas podem ficar para trás ou não se sentir ouvidas.',
        signal: 'Colegas param de discordar de você em reunião.',
      },
      decides:
        'Você decide rápido e prefere corrigir depois a esperar demais. Informação suficiente, para você, costuma ser menos do que para os outros.',
      communicates:
        'Você comunica de forma objetiva, sem rodeio. Ganha tempo, mas às vezes soa mais duro do que pretende.',
      reacts:
        'Sob pressão, você acelera e assume o controle. O risco é centralizar e deixar pouco espaço para o time.',
      energy: [
        'Metas claras e desafiadoras',
        'Autonomia para decidir',
        'Ver resultado rápido',
        'Resolver problemas que travam os outros',
      ],
      drains: [
        'Processo lento e muita aprovação',
        'Reunião sem decisão',
        'Falta de clareza sobre quem decide',
        'Tarefa repetitiva sem propósito',
      ],
      thrives: {
        ambiente: 'Ritmo rápido, metas visíveis e espaço para agir.',
        lideranca: 'Quem combina o objetivo e confia no caminho que você escolher.',
        rotina: 'Variada, com problemas novos para resolver.',
        reconhecimento: 'Por resultado entregue e por desafios maiores.',
      },
      plan: [
        {
          scenario: 'Na próxima decisão que afeta outra pessoa do time',
          action: 'pergunte a ela, antes de decidir, o que ela vê de risco.',
          question: 'O que essa pessoa trouxe que você não tinha considerado?',
        },
        {
          scenario: 'Na próxima conversa difícil',
          action: 'comece pelo objetivo comum e só depois vá ao ponto.',
          question: 'A conversa terminou com um combinado ou com um silêncio?',
        },
        {
          scenario: 'Em uma tarefa desta semana',
          action: 'delegue por inteiro e não retome no meio do caminho.',
          question: 'Quantas vezes você quis intervir, e o que aconteceu quando não interveio?',
        },
      ],
    },
    evaluator: {
      synthesis:
        'Preferência por execução e decisão. Tende a render em contextos de autonomia, meta e mudança; pede atenção à escuta e ao ritmo do time.',
      roleFavors: [
        'Funções com meta, prazo e autonomia',
        'Gestão de crise, abertura de frente e retomada',
        'Negociação e decisão sob incerteza',
      ],
      roleNeedsSupport: [
        'Funções de alto detalhe e conferência',
        'Ambientes muito regulados ou lentos',
        'Papéis de suporte contínuo sem decisão própria',
      ],
      costly:
        'Em funções que exigem consulta, consenso ou conformidade, a velocidade e a vontade de decidir sozinho custam caro: atrito com pares e etapas de qualidade puladas.',
      lead: {
        comunicacao:
          'Seja direto e breve: objetivo, prazo e o que está em jogo. Evite rodeios e excesso de contexto.',
        delegacao:
          'Delegue o resultado, não o passo a passo. Combine limites claros (o que não pode) e deixe o caminho com a pessoa.',
        feedback:
          'Objetivo e frequente, com fatos. Diga o impacto no resultado; elogio genérico tem pouco efeito.',
        reconhecimento:
          'Responsabilidade maior, desafio novo e visibilidade do resultado entregue.',
        evitar: 'Microgestão, decisões travadas sem explicação e reuniões longas sem conclusão.',
      },
      risks: [
        {
          risk: 'Centralizar decisões e esvaziar o time',
          signal: 'O time passa a esperar a pessoa para tudo.',
        },
        { risk: 'Atrito por tom duro', signal: 'Colegas evitam discordar dela em público.' },
        { risk: 'Pular etapas de qualidade', signal: 'Retrabalho em entregas feitas com pressa.' },
      ],
      interview: [
        {
          question:
            'Conte uma decisão importante que você tomou com pouca informação. O que pesou e o que faria diferente?',
          confirms:
            'Exemplo concreto, decisão assumida em primeira pessoa e aprendizado sobre o que não consultou.',
          denies: 'Decisões sempre tomadas em grupo ou depois de esperar a orientação de alguém.',
        },
        {
          question: 'Como você age quando discorda da forma como seu gestor quer fazer algo?',
          confirms: 'Discorda de forma aberta e propõe outro caminho.',
          denies: 'Executa sem questionar ou só discorda depois, com terceiros.',
        },
        {
          question: 'Fale de uma vez em que sua velocidade gerou um problema para outra pessoa.',
          confirms: 'Reconhece o efeito no outro e descreve o que mudou depois.',
          denies: 'Não encontra exemplo, ou descreve lentidão e não pressa.',
        },
        {
          question: 'Como você decide o que delegar e como acompanha o que delegou?',
          confirms: 'Delega o resultado e combina limites; reconhece a vontade de retomar.',
          denies: 'Prefere fazer tudo pessoalmente ou detalha cada passo de quem executa.',
        },
        {
          question:
            'Que processo você considera desnecessário? E qual você respeita mesmo achando lento?',
          confirms: 'Impaciência clara com processo, mas critério para o que respeita.',
          denies: 'Valoriza processo em si e se sente melhor com etapas definidas.',
        },
      ],
      ceo: [
        {
          reflection: 'A pessoa tende a decidir antes de consultar.',
          ask: 'Quem precisa ser ouvido antes das decisões dela, e isso está combinado?',
        },
        {
          reflection: 'Rende mais com meta clara e autonomia.',
          ask: 'A meta desta função está escrita e o limite de decisão está claro?',
        },
        {
          reflection: 'Sob cobrança, tende a centralizar.',
          ask: 'Quem no time sinaliza quando ela estiver fazendo tudo sozinha?',
        },
      ],
      teamConcentrated:
        'Muitos executores juntos decidem rápido e disputam a frente. Pergunta de gestão: quem decide o quê, e quem confere a qualidade?',
      teamMissing:
        'Ninguém com preferência por decidir e assumir a frente. Pergunta de gestão: quando o time trava, quem destrava?',
    },
    bandHigh:
      'Busca controle do resultado e decide rápido; tende à impaciência com demora e consulta.',
    bandLow:
      'Prefere decidir com consenso ou com mais informação; menos inclinação a disputar a liderança da situação.',
    pressureUp:
      'Na semana difícil, assume o comando e acelera: tende a decidir sozinho e a cobrar mais duro.',
    pressureDown:
      'Na semana difícil, recua da decisão: espera orientação ou mais informação antes de agir.',
    pressureTipUp:
      'Quando perceber que está decidindo tudo sozinho, escolha uma decisão pequena e passe para alguém do time ainda nesta semana.',
    pressureTipDown:
      'Se notar que está esperando orientação para agir, defina você mesmo o primeiro passo e avise quem precisa saber.',
    askForHelp:
      'Peça a alguém de confiança que revise as decisões que você tomou às pressas antes de elas virarem regra.',
  },
  I: {
    name: 'Comunicador',
    verb: 'conecta',
    verbLine: 'Conecta: aproxima pessoas, engaja e convence pela relação.',
    oneLiner: 'Conecta. Convence pela energia e pela relação.',
    firstMove: 'Falar com as pessoas.',
    color: '#F2B705',
    ink: '#8A6500',
    soft: '#FDF3D3',
    character: '/brand/disc-i.png',
    temperament: 'Sanguíneo',
    temperamentWords: 'entusiasmado, espontâneo, comunicativo, disperso sob rotina',
    respondent: {
      summary:
        'No dia a dia, você aproxima pessoas e coloca energia no ambiente. Gosta de conversar, trocar ideias e trabalhar com gente, e costuma convencer mais pela relação do que pelo argumento técnico.',
      strengths: [
        {
          title: 'Confiança rápida',
          example: 'Com quem acabou de conhecer, você cria conversa e abertura em poucos minutos.',
        },
        {
          title: 'Explicar e engajar',
          example:
            'Você apresenta uma ideia de um jeito que as pessoas entendem e topam participar.',
        },
      ],
      contextStrength: {
        title: 'Ponte entre pessoas',
        text: 'Mesmo sem ser o seu jeito principal, você consegue aproximar lados e animar o grupo quando o clima pede.',
      },
      cost: 'O entusiasmo que engaja pode deixar o fechamento, o registro e o detalhe para depois.',
      perceived:
        'Quem trabalha com você costuma ver alguém acessível, que anima o grupo e conhece gente em todas as áreas.',
      attention: {
        name: 'Começar mais do que terminar',
        text: 'O entusiasmo com o novo pode deixar tarefas de fechamento e detalhes para depois.',
        signal: 'Prazos aceitos com animação começam a escorregar.',
      },
      decides:
        'Você decide considerando as pessoas envolvidas e o clima. Às vezes decide pelo entusiasmo do momento e revê depois.',
      communicates:
        'Você comunica com facilidade e calor. Fala bem em grupo e tende a preencher silêncios.',
      reacts:
        'Sob pressão, você busca apoio e conversa. O risco é dispersar ou evitar a conversa difícil para manter o clima bom.',
      energy: [
        'Trabalhar com gente',
        'Ideias e projetos novos',
        'Reconhecimento e retorno',
        'Ambiente leve e colaborativo',
      ],
      drains: [
        'Trabalho solitário por muito tempo',
        'Rotina repetitiva',
        'Clima frio ou de cobrança constante',
        'Excesso de controle e relatório',
      ],
      thrives: {
        ambiente: 'Colaborativo, com troca e espaço para ideias.',
        lideranca: 'Quem dá retorno frequente e reconhece o esforço.',
        rotina: 'Com contato com pessoas e alguma variedade.',
        reconhecimento: 'Público, na frente do time.',
      },
      plan: [
        {
          scenario: 'No fim de cada dia desta semana',
          action: 'anote as três tarefas que precisam ser fechadas amanhã.',
          question: 'Quantas das três você fechou no dia seguinte?',
        },
        {
          scenario: 'Antes de aceitar o próximo prazo',
          action: 'confira o que já está na sua lista e diga o que sai para o novo caber.',
          question: 'O prazo combinado foi cumprido sem correria?',
        },
        {
          scenario: 'Na próxima conversa difícil',
          action: 'trate o assunto no mesmo dia, mesmo que o clima fique tenso por um momento.',
          question: 'O que mudou depois que o assunto foi falado?',
        },
      ],
    },
    evaluator: {
      synthesis:
        'Preferência por influência e relacionamento. Tende a render em contato com pessoas, mobilização e mudança; pede estrutura para fechamento e detalhe.',
      roleFavors: [
        'Relacionamento com cliente, vendas e parcerias',
        'Comunicação interna, treinamento e integração',
        'Projetos que dependem de engajar pessoas',
      ],
      roleNeedsSupport: [
        'Funções analíticas e solitárias',
        'Rotinas de controle, conferência e conciliação',
        'Papéis com pouco contato humano',
      ],
      costly:
        'Em funções de controle, conferência ou trabalho solitário, a busca por contato e novidade custa caro: dispersão, registro incompleto e prazos que escorregam.',
      lead: {
        comunicacao: 'Converse, não só mande mensagem. Dê contexto e mostre o impacto nas pessoas.',
        delegacao:
          'Delegue com combinado de prazo e pontos de checagem; ajude a quebrar em etapas.',
        feedback:
          'Comece pelo que funcionou, seja específico no ajuste e combine a próxima conversa.',
        reconhecimento: 'Público, visível e frequente; oportunidades de representar o time.',
        evitar: 'Isolamento, críticas em público e ambientes de controle excessivo.',
      },
      risks: [
        {
          risk: 'Compromissos acima da capacidade',
          signal: 'Prazos aceitos com entusiasmo que começam a escorregar.',
        },
        {
          risk: 'Detalhe e registro negligenciados',
          signal: 'Informação importante que fica só na conversa.',
        },
        {
          risk: 'Evitar conflito necessário',
          signal: 'Problemas conhecidos que não chegam ao gestor.',
        },
      ],
      interview: [
        {
          question:
            'Conte um projeto que você começou com entusiasmo. Como garantiu que ele fosse concluído?',
          confirms:
            'Descreve a largada com energia e um apoio externo (pessoa, ferramenta) para fechar.',
          denies: 'Descreve método próprio de acompanhamento detalhado, sem esforço aparente.',
        },
        {
          question: 'Como você organiza tarefas de rotina que não envolvem pessoas?',
          confirms: 'Admite dificuldade ou procura transformar a rotina em algo com gente.',
          denies: 'Gosta da rotina solitária e descreve organização minuciosa.',
        },
        {
          question: 'Fale de uma conversa difícil que você precisou ter. Como se preparou?',
          confirms: 'Adiou a conversa para preservar o clima, ou suavizou a mensagem.',
          denies: 'Foi direto ao ponto sem preocupação com a reação.',
        },
        {
          question: 'Como você lida quando seu trabalho não é visto ou reconhecido?',
          confirms: 'Sente falta de retorno e procura visibilidade.',
          denies: 'Indiferença ao reconhecimento; foco só na tarefa.',
        },
        {
          question:
            'Dê um exemplo de compromisso que aceitou e não conseguiu cumprir. O que aprendeu?',
          confirms: 'Exemplo de excesso de compromissos aceitos ao mesmo tempo.',
          denies: 'Dificuldade de lembrar um exemplo; tendência a recusar pedidos.',
        },
      ],
      ceo: [
        {
          reflection: 'A pessoa engaja rápido e tende a aceitar mais do que fecha.',
          ask: 'Quem acompanha os prazos dela, e com que frequência?',
        },
        {
          reflection: 'Rende mais em contato com gente.',
          ask: 'Quanto desta função é contato com pessoas e quanto é trabalho sozinho?',
        },
        {
          reflection: 'Tende a evitar a conversa que esfria o clima.',
          ask: 'Os problemas do time chegam até você a tempo?',
        },
      ],
      teamConcentrated:
        'Muitos comunicadores juntos geram energia e ideia, e pouco fechamento. Pergunta de gestão: quem registra, confere e conclui?',
      teamMissing:
        'Ninguém com preferência por engajar e comunicar. Pergunta de gestão: quem leva a mensagem do time para fora e cuida do clima?',
    },
    bandHigh: 'Busca contato, influência e reconhecimento; tende a dispersar em rotina e detalhe.',
    bandLow:
      'Mais reservado e seletivo nas relações; prefere convencer por fato a convencer por entusiasmo.',
    pressureUp:
      'Na semana difícil, fala mais e busca apoio: tende a mobilizar pessoas, mas também a dispersar.',
    pressureDown: 'Na semana difícil, se recolhe: fica mais quieto e menos disponível para o time.',
    pressureTipUp:
      'Quando a agenda encher de conversas, reserve um horário fixo no dia só para fechar pendências.',
    pressureTipDown:
      'Se perceber que sumiu do time, mande uma atualização curta do que está fazendo, mesmo sem novidade.',
    askForHelp:
      'Peça a alguém do time que acompanhe os prazos com você e cobre o fechamento das pendências.',
  },
  S: {
    name: 'Planejador',
    verb: 'sustenta',
    verbLine: 'Sustenta: mantém o ritmo, cumpre o combinado e dá estabilidade ao time.',
    oneLiner: 'Sustenta. Mantém o time de pé e cumpre o combinado.',
    firstMove: 'Cuidar da estabilidade do grupo.',
    color: '#3FA060',
    ink: '#2E7A47',
    soft: '#E2F2E7',
    character: '/brand/disc-s.png',
    temperament: 'Fleumático',
    temperamentWords: 'calmo, constante, conciliador, evita atrito',
    respondent: {
      summary:
        'No dia a dia, você é a pessoa com quem o time pode contar. Cumpre o que combina, mantém a calma e prefere um ritmo constante e previsível, em que todos sabem o que esperar.',
      strengths: [
        {
          title: 'Confiabilidade',
          example: 'O que você combinou acontece, sem ninguém precisar cobrar.',
        },
        {
          title: 'Calma no aperto',
          example: 'Em dia caótico, você mantém o ritmo e acalma quem está ao lado.',
        },
      ],
      contextStrength: {
        title: 'Constância',
        text: 'Mesmo sem ser o seu jeito principal, você consegue sustentar uma rotina e cumprir o combinado quando o time precisa de previsibilidade.',
      },
      cost: 'A busca por harmonia pode fazer você guardar o que pensa e aceitar mais do que dá conta.',
      perceived:
        'Quem trabalha com você costuma ver alguém leal, paciente e que lembra do que cada pessoa precisa.',
      attention: {
        name: 'Guardar para não incomodar',
        text: 'Para evitar atrito, você pode deixar de dizer o que pensa ou aceitar mais do que dá conta.',
        signal: 'Você só fala do cansaço quando já está esgotado.',
      },
      decides:
        'Você decide com calma e considerando o impacto nas pessoas. Prefere ter tempo e segurança antes de mudar o que funciona.',
      communicates:
        'Você comunica de forma tranquila e cuidadosa. Escuta mais do que fala e evita confronto direto.',
      reacts:
        'Sob pressão, você segura o ritmo e protege o grupo. O risco é absorver demais e não pedir ajuda.',
      energy: [
        'Ambiente estável e cordial',
        'Saber o que esperar',
        'Ajudar e ser útil ao time',
        'Relações de longo prazo',
      ],
      drains: [
        'Mudança de última hora',
        'Clima de conflito',
        'Cobrança agressiva',
        'Prioridades que mudam todo dia',
      ],
      thrives: {
        ambiente: 'Cordial, previsível e com combinados claros.',
        lideranca: 'Quem avisa antes das mudanças e explica o porquê.',
        rotina: 'Constante, com tempo para fazer bem feito.',
        reconhecimento: 'Reservado, em conversa individual.',
      },
      plan: [
        {
          scenario: 'Quando algo te incomodar nesta semana',
          action: 'fale na mesma semana, em conversa a dois.',
          question: 'O que você disse, e como a pessoa recebeu?',
        },
        {
          scenario: 'No próximo pedido novo',
          action: 'diga o que precisa sair da sua lista para ele caber.',
          question: 'O pedido coube sem você ficar até mais tarde?',
        },
        {
          scenario: 'Diante da próxima mudança',
          action: 'pergunte o motivo e o prazo antes de começar.',
          question: 'Saber o porquê mudou o seu tempo de adaptação?',
        },
      ],
    },
    evaluator: {
      synthesis:
        'Preferência por constância e cooperação. Tende a render em rotinas, atendimento contínuo e times que precisam de coesão; pede apoio em mudança e posicionamento.',
      roleFavors: [
        'Rotinas operacionais e administrativas contínuas',
        'Atendimento e suporte de longo prazo',
        'Funções que sustentam o time e a qualidade do clima',
      ],
      roleNeedsSupport: [
        'Ambientes de mudança constante',
        'Funções de negociação dura ou cobrança',
        'Papéis que exigem decisão rápida e solitária',
      ],
      costly:
        'Em funções de mudança constante, negociação dura ou decisão solitária, a preferência por estabilidade e harmonia custa caro: adiamento, resistência silenciosa e sobrecarga.',
      lead: {
        comunicacao:
          'Calma e antecipada. Explique o porquê e o impacto nas pessoas; dê tempo para a pessoa processar.',
        delegacao:
          'Delegue com instrução clara, exemplo e disponibilidade para dúvidas; combine o padrão esperado.',
        feedback:
          'Em particular, com cuidado e constância. Pergunte como a pessoa está antes de entrar no ajuste.',
        reconhecimento:
          'Individual e sincero; segurança, pertencimento e reconhecimento da contribuição para o time.',
        evitar: 'Mudanças sem aviso, exposição em público e clima de conflito.',
      },
      risks: [
        {
          risk: 'Sobrecarga silenciosa',
          signal: 'Aceita tudo e só demonstra cansaço quando já está esgotado.',
        },
        {
          risk: 'Resistência passiva à mudança',
          signal: 'Concorda na reunião e mantém o jeito antigo na prática.',
        },
        {
          risk: 'Problemas que não sobem',
          signal: 'Conflitos no time chegam ao gestor tarde demais.',
        },
      ],
      interview: [
        {
          question:
            'Conte uma mudança grande no seu trabalho. Como você se adaptou e quanto tempo levou?',
          confirms: 'Adaptação gradual, com necessidade de entender o motivo antes.',
          denies: 'Entusiasmo imediato com a mudança e adaptação em poucos dias.',
        },
        {
          question: 'Como você age quando discorda de uma decisão do time?',
          confirms: 'Guarda para si ou fala depois, em particular.',
          denies: 'Discorda na hora, em público.',
        },
        {
          question: 'Fale de uma vez em que você disse "não" a um pedido. Como foi?',
          confirms: 'Exemplo raro ou desconfortável de recusa.',
          denies: 'Recusa com facilidade e sem desconforto.',
        },
        {
          question: 'Como você percebe que está sobrecarregado e o que faz com isso?',
          confirms: 'Percebe tarde e segura sozinho.',
          denies: 'Sinaliza cedo e redistribui o trabalho.',
        },
        {
          question: 'Que tipo de rotina faz você render melhor? E qual tira sua energia?',
          confirms: 'Rotina estável e previsível como preferida.',
          denies: 'Prefere variedade e se aborrece com repetição.',
        },
      ],
      ceo: [
        {
          reflection: 'A pessoa sustenta a rotina e tende a não reclamar.',
          ask: 'Como você vai saber que ela está sobrecarregada antes de ela parar?',
        },
        {
          reflection: 'Rende mais com previsibilidade.',
          ask: 'As próximas mudanças desta área estão sendo avisadas com antecedência?',
        },
        {
          reflection: 'Tende a concordar em público e discordar em silêncio.',
          ask: 'Em que espaço ela pode discordar sem exposição?',
        },
      ],
      teamConcentrated:
        'Muitos planejadores juntos dão estabilidade e lealdade, e resistem à mudança. Pergunta de gestão: quem puxa a mudança quando ela é necessária?',
      teamMissing:
        'Ninguém com preferência por constância e cuidado com o grupo. Pergunta de gestão: quem sustenta a rotina e segura o clima quando aperta?',
    },
    bandHigh:
      'Busca estabilidade, previsibilidade e harmonia; tende a evitar conflito e mudança brusca.',
    bandLow: 'Mais confortável com mudança e variedade; menor paciência com rotina e ritmo lento.',
    pressureUp:
      'Na semana difícil, se apega ao combinado: busca rotina, evita conflito e pode resistir a mudanças.',
    pressureDown:
      'Na semana difícil, perde a constância: fica mais reativo e menos paciente com o ritmo do grupo.',
    pressureTipUp:
      'Se estiver se apegando ao combinado antigo, pergunte o que mudou de prioridade antes de resistir à mudança.',
    pressureTipDown:
      'Quando a paciência acabar, faça uma pausa antes de responder e diga do que precisa para voltar ao seu ritmo.',
    askForHelp:
      'Peça ajuda antes de chegar ao limite: diga o que está pesando e o que pode sair da sua lista.',
  },
  C: {
    name: 'Analista',
    verb: 'confere',
    verbLine: 'Confere: busca critério, dado e qualidade antes de concordar.',
    oneLiner: 'Confere. Quer critério, dado e padrão antes de concordar.',
    firstMove: 'Entender antes de responder.',
    color: '#2F78DD',
    ink: '#1F5BB0',
    soft: '#E1ECFB',
    character: '/brand/disc-c.png',
    temperament: 'Melancólico',
    temperamentWords: 'criterioso, profundo, reservado, exigente consigo',
    respondent: {
      summary:
        'No dia a dia, você quer entender o porquê das coisas e fazer certo. Confere, organiza e segue critério, e se sente melhor quando há padrão claro e tempo para pensar.',
      strengths: [
        {
          title: 'Precisão',
          example: 'Você encontra o erro que passou por todo mundo antes da entrega.',
        },
        {
          title: 'Decisão com dado',
          example:
            'Você pede o número ou o critério antes de concordar, e isso evita decisões ruins.',
        },
      ],
      contextStrength: {
        title: 'Cuidado com a qualidade',
        text: 'Mesmo sem ser o seu jeito principal, você consegue parar, conferir e organizar quando a entrega exige precisão.',
      },
      cost: 'A busca pelo certo pode atrasar entregas e deixar você exigente demais consigo e com os outros.',
      perceived:
        'Quem trabalha com você costuma ver alguém em quem dá para confiar no detalhe e que pergunta o que ninguém perguntou.',
      attention: {
        name: 'Perfeição que atrasa',
        text: 'A busca pelo certo pode atrasar entregas e deixar você exigente demais consigo e com os outros.',
        signal: 'Entregas ficam "quase prontas" por dias.',
      },
      decides:
        'Você decide com base em dado e critério. Prefere esperar a ter segurança do que decidir no escuro.',
      communicates:
        'Você comunica de forma precisa e estruturada. Pode parecer reservado ou crítico quando questiona.',
      reacts:
        'Sob pressão, você se fecha e confere ainda mais. O risco é travar a decisão ou se cobrar além da conta.',
      energy: [
        'Critério e regra claros',
        'Tempo para pensar e fazer bem feito',
        'Trabalho concentrado',
        'Informação completa e organizada',
      ],
      drains: [
        'Resposta vaga e mudança sem explicação',
        'Pressa que compromete a qualidade',
        'Improviso constante',
        'Interrupções frequentes',
      ],
      thrives: {
        ambiente: 'Organizado, com padrão e espaço para concentração.',
        lideranca: 'Quem explica o critério e dá tempo para análise.',
        rotina: 'Estruturada, com etapas claras.',
        reconhecimento: 'Pela qualidade e pela competência técnica.',
      },
      plan: [
        {
          scenario: 'No início de cada tarefa desta semana',
          action: 'escreva o que é "pronto" para ela e pare quando chegar lá.',
          question: 'Quantas tarefas você entregou no ponto combinado, sem retocar?',
        },
        {
          scenario: 'Na próxima decisão sem todos os dados',
          action: 'defina um prazo para decidir mesmo assim.',
          question: 'A decisão no prazo foi pior do que seria com mais dado?',
        },
        {
          scenario: 'Na próxima vez que questionar algo',
          action: 'traga junto uma alternativa.',
          question: 'A pessoa recebeu a crítica como contribuição?',
        },
      ],
    },
    evaluator: {
      synthesis:
        'Preferência por qualidade e critério. Tende a render em funções técnicas, de controle e de padrão; pede apoio em ambiguidade e prazo curto.',
      roleFavors: [
        'Funções técnicas, analíticas e de controle',
        'Qualidade, conformidade, auditoria e processos',
        'Planejamento e organização de informação',
      ],
      roleNeedsSupport: [
        'Operações que mudam todo dia',
        'Funções de improviso e alta exposição social',
        'Decisões rápidas com informação incompleta',
      ],
      costly:
        'Em funções de improviso, alta exposição ou decisão rápida, a busca por critério e precisão custa caro: atraso, trava diante da ambiguidade e rigidez com o time.',
      lead: {
        comunicacao:
          'Escrita, organizada e com dados. Antecipe o assunto e dê tempo para análise antes da conversa.',
        delegacao:
          'Delegue com critério de qualidade e prazo explícitos; combine o que é "bom o suficiente".',
        feedback: 'Específico e baseado em fato. Evite generalizações; explique o critério usado.',
        reconhecimento:
          'Pela qualidade técnica, com autonomia sobre o método e confiança no padrão da pessoa.',
        evitar:
          'Mudanças sem explicação, cobrança por pressa sem critério e exposição pública de erros.',
      },
      risks: [
        {
          risk: 'Atraso por perfeccionismo',
          signal: 'Entregas que ficam "quase prontas" por muito tempo.',
        },
        { risk: 'Rigidez com o time', signal: 'Colegas evitam pedir ajuda por medo da crítica.' },
        {
          risk: 'Travar diante da ambiguidade',
          signal: 'Pedido de mais informação quando o prazo já venceu.',
        },
      ],
      interview: [
        {
          question:
            'Conte uma decisão que você precisou tomar sem todos os dados. Como lidou com isso?',
          confirms: 'Desconforto claro e busca de critério mínimo antes de decidir.',
          denies: 'Conforto em decidir no escuro e corrigir depois.',
        },
        {
          question: 'Como você decide quando uma entrega está boa o suficiente?',
          confirms: 'Critério explícito e tendência a revisar além do pedido.',
          denies: 'Entrega rápido e ajusta conforme o retorno.',
        },
        {
          question: 'Fale de uma vez em que discordou de um processo. O que fez?',
          confirms: 'Questionou com argumento e dado, por canal formal.',
          denies: 'Ignorou o processo ou contornou sem questionar.',
        },
        {
          question: 'Como reage quando alguém entrega algo abaixo do seu padrão?',
          confirms: 'Aponta o erro com precisão; pode refazer sozinho.',
          denies: 'Aceita sem conferir ou prioriza o clima sobre o padrão.',
        },
        {
          question:
            'Que interrupção mais atrapalha seu trabalho e como você se organiza para evitá-la?',
          confirms: 'Descreve proteção de tempo de concentração.',
          denies: 'Gosta de interrupções e de trabalhar em meio à conversa.',
        },
      ],
      ceo: [
        {
          reflection: 'A pessoa tende a esperar critério antes de decidir.',
          ask: 'O que é "bom o suficiente" nesta função está definido?',
        },
        {
          reflection: 'Rende mais com padrão e tempo de concentração.',
          ask: 'A rotina da função permite trabalho concentrado?',
        },
        {
          reflection: 'Sob cobrança, tende a conferir ainda mais.',
          ask: 'Quem decide quando o prazo pesa mais do que a última revisão?',
        },
      ],
      teamConcentrated:
        'Muitos analistas juntos dão qualidade e critério, e demoram a decidir. Pergunta de gestão: quem define o prazo-limite da análise?',
      teamMissing:
        'Ninguém com preferência por critério e conferência. Pergunta de gestão: quem garante padrão, registro e qualidade antes da entrega?',
    },
    bandHigh:
      'Busca critério, precisão e controle de qualidade; tende ao perfeccionismo e à cautela.',
    bandLow:
      'Mais confortável com improviso e informação incompleta; menor apego a regra e detalhe.',
    pressureUp:
      'Na semana difícil, aumenta o controle: confere mais, pede mais dado e pode travar a decisão.',
    pressureDown:
      'Na semana difícil, relaxa o padrão: aceita entregar com menos conferência para ganhar tempo.',
    pressureTipUp:
      'Se estiver conferindo pela terceira vez, defina um limite: entregue e anote o que fica para revisar depois.',
    pressureTipDown:
      'Quando cortar etapas para ganhar tempo, escolha a única conferência que não pode faltar e mantenha só ela.',
    askForHelp:
      'Peça a quem define as prioridades um prazo-limite para a revisão, e entregue quando ele chegar.',
  },
};

const styles: Style[] = ['D', 'I', 'S', 'C'];
const pairKey = (a: Style, b: Style) =>
  styles.filter((style) => style === a || style === b).join('');

export const COMBINATIONS: Record<string, { name: string; text: string }> = {
  DI: {
    name: 'Mobilizador',
    text: 'Une decisão e influência: puxa o resultado e leva as pessoas junto. Rende abrindo frentes e liderando mudança; precisa de apoio em detalhe, rotina e acompanhamento.',
  },
  DS: {
    name: 'Realizador constante',
    text: 'Combina impulso de resultado com cuidado pela estabilidade do time. Executa com firmeza sem atropelar; pode oscilar entre acelerar e preservar o clima.',
  },
  DC: {
    name: 'Estrategista executor',
    text: 'Pensa e executa: decide rápido, mas com critério. Rende em problemas complexos com meta clara; tende a exigir muito de si e dos outros e a ter pouca paciência com o improviso alheio.',
  },
  IS: {
    name: 'Agregador',
    text: 'Engaja e mantém: aproxima pessoas e sustenta a relação no tempo. Rende em atendimento, integração e times que precisam de coesão; tende a evitar conflitos e decisões duras.',
  },
  IC: {
    name: 'Comunicador criterioso',
    text: 'Une comunicação e precisão: explica bem o que é técnico. Rende em treinamento, consultoria e relacionamento que exige conteúdo; pode oscilar entre o entusiasmo e a autocrítica.',
  },
  SC: {
    name: 'Guardião da qualidade',
    text: 'Constância com critério: faz certo e faz sempre. Rende em processos, controle e operações estáveis; precisa de apoio em mudança rápida e em situações de exposição.',
  },
};

export function combinationOf(primary: Style, secondary: Style) {
  return COMBINATIONS[pairKey(primary, secondary)];
}

/** Nome do perfil, igual em todas as páginas e nos dois relatórios. */
export function profileName(primary: Style, secondary: Style, mixed: boolean) {
  const p = STYLE_CONTENT[primary].name,
    s = STYLE_CONTENT[secondary].name;
  return mixed ? `Perfil misto: ${p} e ${s}` : `${p}, com traço ${s}`;
}

export const BAND_EXPLAIN =
  'Faixas: Baixo (0–39), Moderado (40–59), Alto (60–79), Muito alto (80–100).';

/** Natureza do documento (parecer, item 6): substitui "leitura de triagem / não é diagnóstico". */
export const NATURE =
  'Autoavaliação de preferências comportamentais de trabalho. Não é avaliação psicológica, não mede competência e não serve de base isolada para decisão de contratação.';

/** Texto do consentimento (aceita **negrito** e *itálico*; a tela converte). */
export const CONSENT_TEXT =
  'Este é um levantamento de **perfil comportamental**, baseado na metodologia **DISC**. Ele mostra *as suas preferências de comportamento no trabalho* — **não é avaliação psicológica** e **não avalia competência nem desempenho**. **Não existe resposta certa ou errada**: quanto mais *espontâneo* você for, mais útil o resultado será para você. Suas respostas ficam **registradas com segurança** e são acessadas apenas por quem conduz o processo. Você pode pedir acesso ao seu resultado, a explicação do método, a revisão ou a exclusão dos seus dados **quando quiser**.';

export const DISCLAIMER = `${NATURE} Não mede desempenho nem potencial e não substitui avaliação profissional.`;

export const VALIDITY =
  'O resultado descreve como você se posiciona hoje. Contexto, papel e momento mudam a leitura: ele vale como leitura atual por 6 meses.';

export const NATURAL_INSTRUCTION =
  'Responda pensando em **como você costuma agir** no trabalho na maior parte do tempo. *Não* é como você gostaria de ser, nem como age em um dia fora do normal.';
export const PRESSURE_INSTRUCTION =
  'Todos temos semanas boas e semanas difíceis. Agora imagine uma semana com **mais cobrança** e **prazos apertados** — pode ser uma que você já viveu ou uma situação hipotética. Responda os próximos **6 blocos** pensando em como você **age ou agiria** nessa semana.';
