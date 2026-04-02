window.FUNNEL_DATA = {
  meta: {
    id: "taichi-harno-funil-novo",
    name: "Tai Chi para Iniciantes",
    totalSteps: 40
  },

  steps: [
    {
      id: "step_01",
      index: 1,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-01-capa.png"],
      layout: "split-left-image",
      texts: [
        "TAI CHI PARA INICIANTES",
        "De acordo com sua idade: 👇",
        "Teste de 2 minutos"
      ],
      optionSets: [
        {
          name: "faixa_etaria",
          multiple: false,
          options: [
            { label: "40 - 49 anos" },
            { label: "50 - 59 anos" },
            { label: "60 - 69 anos" },
            { label: "+70 anos" }
          ]
        }
      ],
      next: "step_02"
    },

    {
      id: "step_02",
      index: 2,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-02-bem-vindo.png"],
      texts: [
        "Bem vindo",
        "A nossa academia de Tai chi 💪",
        "Aqui você vai fortalecer e definir o corpo, recuperar mobilidade, aliviar dores nas articulações e na coluna e ainda aumentar a testosterona de forma natural, através de um método milenar inteligente, sem sofrer e sem desgastar o corpo."
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_03"
    },

    {
      id: "step_03",
      index: 3,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Qual dessas situações é mais importante para você agora?"
      ],
      optionSets: [
        {
          name: "objetivo_principal",
          multiple: false,
          options: [
            { label: "Perder barriga e emagrecer", image: "objetivo-emagrecer.png" },
            { label: "Aliviar dores no corpo", image: "objetivo-dores.png" },
            { label: "Ganhar força e músculo", image: "objetivo-forca.png" },
            { label: "Aumentar testosterona naturalmente", image: "objetivo-testosterona.png" },
            { label: "Cuidar da saúde para envelhecer bem", image: "objetivo-saude.png" }
          ]
        }
      ],
      next: "step_04"
    },

    {
      id: "step_04",
      index: 4,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-04a-40-mais.png", "step-04b-40-mais.png"],
      texts: [
        "A solução certa está aqui.",
        
        "❌ A barriga começa a crescer\n❌ Os movimentos ficam limitados\n❌ A disposição diminui\n❌ As dores aparecem\n❌ O cansaço vira constante",
        "👉 Não é falta de esforço.",
        "É falta do estímulo certo para o corpo nessa fase da vida."
      ],
      buttons: [
        { label: "Quero cuidar do meu corpo →", kind: "next", destination: "next" }
      ],
      next: "step_05"
    },

    {
      id: "step_05",
      index: 5,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-05-conhece-tai-chi.png"],
      layout: "split-left-image",
      texts: [
        "Você conhece o Tai chi?"
      ],
      optionSets: [
        {
          name: "conhece_tai_chi",
          multiple: false,
          options: [
            { label: "Sim, pratico com frequência" },
            { label: "Sim, Já experimentei" },
            { label: "Nunca pratiquei, mas tenho interesse" }
          ]
        }
      ],
      next: "step_06"
    },

    {
      id: "step_06",
      index: 6,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-06-nao-e-treino-comum.png"],
      texts: [
        "Tai chi não é um treino comum!",
        "É como meditar em movimento.",
        "O Tai Chi é uma prática chinesa milenar que estimula o corpo de forma inteligente usando apenas uma cadeira e o peso do seu corpo.",
        "Ideal para homens acima dos 40 anos que desejam:",
        "✅ Emagrecer rápido e sem sofrimento\n✅ Ficar mais forte e com o corpo mais definido\n✅ Eliminar dores no corpo e articulações\n✅ Reduzir o estresse e dormir melhor"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_07"
    },

    {
      id: "step_07",
      index: 7,
      stepType: "question",
      logo: "logo-harno.png",
      layout: "image-grid",
      texts: [
        "Qual é o seu tipo de corpo atual?"
      ],
      optionSets: [
        {
          name: "tipo_corpo_atual",
          multiple: false,
          options: [
            { label: "Magro", image: "step-07-magro.png" },
            { label: "Falso magro", image: "step-07-falso-magro.png" },
            { label: "Acima do peso", image: "step-07-acima-peso.png" },
            { label: "Bem acima do peso", image: "step-07-bem-acima-peso.png" }
          ]
        }
      ],
      next: "step_08"
    },

    {
      id: "step_08",
      index: 8,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "O que mais incomoda você hoje?",
        "Pode marcar mais de uma opção, se quiser."
      ],
      optionSets: [
        {
          name: "incomodos_hoje",
          multiple: true,
          options: [
            { label: "Estar acima do peso" },
            { label: "Meu corpo vive dolorido e travado" },
            { label: "Vivo cansado e sem energia" },
            { label: "Minha mente não desacelera" },
            { label: "Não tenho mais performance sexual" },
            { label: "Durmo muito mal" },
            { label: "Só quero cuidar da saúde" }
          ]
        }
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_09"
    },

    {
      id: "step_09",
      index: 9,
      stepType: "question",
      logo: "logo-harno.png",
      layout: "image-grid",
      texts: [
        "Qual corpo você gostaria de ter?"
      ],
      optionSets: [
        {
          name: "corpo_desejado",
          multiple: false,
          options: [
            { label: "Magro", image: "step-09-magro.png" },
            { label: "Tonificado", image: "step-09-tonificado.png" },
            { label: "Forte e definido", image: "step-09-forte-definido.png" }
          ]
        }
      ],
      next: "step_10"
    },

    {
      id: "step_10",
      index: 10,
      stepType: "question",
      logo: "logo-harno.png",
      layout: "image-grid",
      texts: [
        "Em quais regiões do corpo você mais gostaria de ver mudanças?",
        "Pode selecionar quantas quiser."
      ],
      optionSets: [
        {
          name: "regioes_mudanca",
          multiple: true,
          options: [
            { label: "Barriga", image: "step-10-barriga.png" },
            { label: "Peito", image: "step-10-peito.png" },
            { label: "Braços finos", image: "step-10-bracos-finos.png" },
            { label: "Pernas finas", image: "step-10-pernas-finas.png" }
          ]
        }
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_11"
    },

    {
      id: "step_11",
      index: 11,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-11-video-aulas.png"],
      texts: [
        "Consiga finalmente um abdômen trincado e tonifique todo seu corpo em casa",
        "Eu gravei aulas em vídeo para você saber exatamente o que fazer. Seu treino será focado em, respeitando seu ritmo e seu corpo"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_12"
    },

    {
      id: "step_12",
      index: 12,
      stepType: "question",
      logo: "logo-harno.png",
      topNote: "Agora vamos conhecer um pouco melhor seu corpo...",
      images: ["step-12-rigidez-pescoco.png"],
      texts: [
        "Você sente dificuldade ou rigidez ao virar o pescoço de um lado para o outro?"
      ],
      optionSets: [
        {
          name: "rigidez_pescoco",
          multiple: false,
          options: [
            { label: "✅ Sim" },
            { label: "🚫 Não" }
          ]
        }
      ],
      next: "step_13"
    },

    {
      id: "step_13",
      index: 13,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-13-bracos-20-segundos.png"],
      texts: [
        "E você aguenta estender os braços por 20 segundos?"
      ],
      optionSets: [
        {
          name: "aguenta_bracos",
          multiple: false,
          options: [
            { label: "✅ Sim" },
            { label: "🚫 Não" }
          ]
        }
      ],
      next: "step_14"
    },

    {
      id: "step_14",
      index: 14,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Como você descreveria um dia normal seu?"
      ],
      optionSets: [
        {
          name: "dia_normal",
          multiple: false,
          options: [
            { label: "Fico a maior parte do tempo parado" },
            { label: "Me movimento pouco" },
            { label: "Sou ativo na maior parte do tempo" }
          ]
        }
      ],
      next: "step_15"
    },

    {
      id: "step_15",
      index: 15,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Como seu peso costuma mudar?"
      ],
      optionSets: [
        {
          name: "peso_costuma_mudar",
          multiple: false,
          options: [
            { label: "Engordo com facilidade, mas tenho dificuldade para emagrecer" },
            { label: "Meu peso sobe e desce com facilidade" },
            { label: "Tenho dificuldade em ganhar peso ou músculos" }
          ]
        }
      ],
      next: "step_16"
    },

    {
      id: "step_16",
      index: 16,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-16-biotipo-mesomorfo.png"],
      texts: [
        "Parece que você tem o biotipo Mesomorfo",
        "Seu corpo tem uma vantagem natural, responde rápido ao movimento e tem boa capacidade de se transformar.",
        "O problema é que sem o estímulo certo, você perde massa muscular e ganha gordura com o tempo.",
        "O Tai Chi vai preservar e fortalecer o que você já tem, acelerar seu metabolismo e devolver a energia e disposição que você sentia anos atrás."
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_17"
    },

    {
      id: "step_17",
      index: 17,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-17-subir-escadas.png"],
      texts: [
        "Como você se sente após subir um lance de escadas?",
        "Esta pergunta serve apenas para conhecermos os limites do seu corpo."
      ],
      optionSets: [
        {
          name: "subir_escadas",
          multiple: false,
          options: [
            { label: "Não consigo subir" },
            { label: "Fico sem fôlego e bem cansado" },
            { label: "Sinto um leve cansaço" },
            { label: "Subo com tranquilidade" }
          ]
        }
      ],
      next: "step_18"
    },

    {
      id: "step_18",
      index: 18,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-18-orgulho-corpo.png"],
      layout: "split-left-image",
      texts: [
        "Quando foi a última vez que você sentiu orgulho do seu corpo?"
      ],
      optionSets: [
        {
          name: "ultima_vez_orgulho",
          multiple: false,
          options: [
            { label: "Menos de um ano atrás" },
            { label: "1 - 3 anos atrás" },
            { label: "Mais de 3 anos" },
            { label: "Nem lembro" }
          ]
        }
      ],
      next: "step_19"
    },

    {
      id: "step_19",
      index: 19,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-19-estudos-confirmam.png"],
      texts: [
        "ESTUDOS CONFIRMAM:",
        "O Tai Chi reprograma o corpo depois dos 40",
        "Não é falta de esforço, é seu corpo pedindo o estímulo certo.",
        "O Tai Chi aumenta testosterona e reduz gordura abdominal naturalmente 👇",
        "Um estudo publicado na JAMA Networking Open (Harvard) analisou 342 homens, na idade média dos 49 anos que fizeram Tai Chi por mais de 3 meses e comprovou que:",
        "📊 Esses homens tiveram um aumento natural da testosterona de 48% em apenas 12 semanas\n🔥 Reduziram em média 83% da gordura abdominal nos primeiros 60 dias\n⚡ Cortisol caiu 31% (hormônio que causa barriga e destrói testosterona)"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_20"
    },

    {
      id: "step_20",
      index: 20,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-20-areas-desconforto.png"],
      texts: [
        "Você sente dificuldade ou desconforto em alguma destas áreas?",
        "Vamos proteger as áreas lesionadas e, ao mesmo tempo, criar um plano para restaurar seu corpo."
      ],
      optionSets: [
        {
          name: "areas_desconforto",
          multiple: true,
          options: [
            { label: "Dores nas costas" },
            { label: "Dores no joelho" },
            { label: "Ombros" },
            { label: "Quadril" },
            { label: "❌ Nenhuma das opções" }
          ]
        }
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_21"
    },

    {
      id: "step_21",
      index: 21,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-21-restaura-corpo.png"],
      texts: [
        "O Tai Chi restaura seu corpo de dentro para fora",
        "Em apenas 7 minutos por dia, sem esforço e sem sair de casa.",
        "🔵 Alivie as dores no corpo e nas articulações\n🔴 Recupere sua mobilidade e flexibilidade\n🟡 Elimine a gordura de forma progressiva e natural\n🟠 Fortaleça os músculos com o mínimo de esforço\n🟢 Acalme o sistema nervoso e reduza o estresse"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_22"
    },

    {
      id: "step_22",
      index: 22,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Como você prefere começar seu treino?",
        "Você pode mudar isso depois, se quiser."
      ],
      optionSets: [
        {
          name: "preferencia_inicio_treino",
          multiple: false,
          options: [
            { label: "Bem leve" },
            { label: "Intermediário" },
            { label: "Mais ativo" },
            { label: "Prefiro que vocês decidam" }
          ]
        }
      ],
      next: "step_23"
    },

    {
      id: "step_23",
      index: 23,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-23-intensidade-media.png"],
      texts: [
        "Ótimo, a intensidade do seu treino será:",
        "Média"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_24"
    },

    {
      id: "step_24",
      index: 24,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Qual duração se encaixa melhor na sua rotina?"
      ],
      optionSets: [
        {
          name: "duracao_rotina",
          multiple: false,
          options: [
            { label: "⏰ 7 minutos" },
            { label: "⏰ 15 minutos" },
            { label: "⏰ 30 minutos" },
            { label: "🏆 Vocês decidem" }
          ]
        }
      ],
      next: "step_25"
    },

    {
      id: "step_25",
      index: 25,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-25-nao-precisa-sofrer.png"],
      texts: [
        "Você não precisa sofrer para ter resultados!",
        "Treinos comuns são longos e podem causar esgotamento e estresse, o Tai Chi funciona acalmando o corpo e a mente, sem esgotá-los",
        "🔵 Perfeito para quem não gosta de sofrer desgastando o corpo.\n🟡 Não precisa de equipamentos\n🟢 Apoia a recuperação, não o excesso de treinamento"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_26"
    },

    {
      id: "step_26",
      index: 26,
      stepType: "content",
      logo: "logo-harno.png",
      topNote: "Últimas perguntas, seu treino está quase pronto ✅",
      images: ["step-26-caminho-objetivo.png"],
      texts: [
        "Vamos traçar o caminho até o seu objetivo?",
        "Para personalizar seu treino e liberar recursos do app, precisamos conhecer você melhor."
      ],
      buttons: [
        { label: "Vamos lá", kind: "next", destination: "next" }
      ],
      next: "step_27"
    },

    {
      id: "step_27",
      index: 27,
      stepType: "range",
      logo: "logo-harno.png",
      texts: [
        "Qual é a sua altura?",
        "☝️ Calculando o seu IMC...\nSua altura nos ajuda a adaptar os movimentos à estrutura e amplitude do seu corpo."
      ],
      field: "altura_cm",
      min: 140,
      max: 210,
      defaultValue: 180,
      unit: "cm",
      buttonLabel: "Próximo passo",
      next: "step_28"
    },

    {
      id: "step_28",
      index: 28,
      stepType: "metric_input",
      logo: "logo-harno.png",
      texts: [
        "Qual é seu peso atual?",
        "Digite abaixo:"
      ],
      field: "peso_atual",
      unit: "kg",
      defaultValue: 0,
      buttonLabel: "Próximo passo",
      next: "step_29"
    },

    {
      id: "step_29",
      index: 29,
      stepType: "metric_input",
      logo: "logo-harno.png",
      texts: [
        "Em qual peso você quer chegar?",
        "Digite abaixo"
      ],
      field: "peso_meta",
      unit: "kg",
      defaultValue: 0,
      buttonLabel: "Continuar",
      next: "step_30"
    },

    {
      id: "step_30",
      index: 30,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Com que frequência você ingere alimentos gordurosos?"
      ],
      optionSets: [
        {
          name: "alimentos_gordurosos",
          multiple: false,
          options: [
            { label: "😎 Eu geralmente evito" },
            { label: "🍗 3 - 5 vezes por semana" },
            { label: "😋 Quase todos os dias" }
          ]
        }
      ],
      next: "step_31"
    },

    {
      id: "step_31",
      index: 31,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-31-pressao-arterial.png"],
      texts: [
        "Tai Chi: comprovado para equilibrar a pressão arterial",
        "O Tai Chi baixa a pressão arterial porque os movimentos lentos e a respiração profunda relaxam o corpo, reduzem adrenalina, melhoram a circulação e fazem o coração trabalhar de forma mais leve, por isso a pressão diminui naturalmente."
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_32"
    },

    {
      id: "step_32",
      index: 32,
      stepType: "question",
      logo: "logo-harno.png",
      images: ["step-32-nivel-energia.png"],
      texts: [
        "Qual é o seu nível médio de energia durante o dia?"
      ],
      optionSets: [
        {
          name: "nivel_energia",
          multiple: false,
          options: [
            { label: "😩 Eu me sinto exausto a maior parte do tempo" },
            { label: "📊 Meus níveis de energia variam ao longo do dia" },
            { label: "🏃 Geralmente sou muito enérgico e ativo" }
          ]
        }
      ],
      next: "step_33"
    },

    {
      id: "step_33",
      index: 33,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Quantas horas de sono você costuma dormir?"
      ],
      optionSets: [
        {
          name: "horas_sono",
          multiple: false,
          options: [
            { label: "😐 Menos de 5 horas" },
            { label: "🥱 5 - 6 horas" },
            { label: "🌙 7 - 8 horas" },
            { label: "😴 Mais de 8 horas" }
          ]
        }
      ],
      next: "step_34"
    },

    {
      id: "step_34",
      index: 34,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-34-durma-melhor.png"],
      texts: [
        "Durma melhor",
        "Você merece um sono profundo, daqueles que renovam o corpo e acalmam a mente.",
        "Com o Tai Chi, o estresse diminui, o corpo desacelera e a mente silencia, e o resultado é dormir rápido, dormir bem e acordar revigorado."
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_35"
    },

    {
      id: "step_35",
      index: 35,
      stepType: "loading",
      logo: "logo-harno.png",
      texts: [
        "Criando seu perfil de condicionamento..."
      ],
      delay: 2200,
      next: "step_36"
    },

    {
      id: "step_36",
      index: 36,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-36-seu-perfil.png"],
      texts: [
        "Seu perfil com base em suas respostas:"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_37"
    },

    {
      id: "step_37",
      index: 37,
      stepType: "question",
      logo: "logo-harno.png",
      texts: [
        "Está pronto para começar sua transformação ainda hoje?"
      ],
      optionSets: [
        {
          name: "pronto_para_comecar",
          multiple: false,
          options: [
            { label: "✅ Sim, vou fazer meu primeiro treino hoje" },
            { label: "✅ Sim, mas começo amanhã" },
            { label: "💪 Não tenho certeza, mas quero tentar" }
          ]
        }
      ],
      next: "step_38"
    },

    {
      id: "step_38",
      index: 38,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-38-loading-personalizado.png"],
      carouselImages: [
        "carrossel-1.png",
        "carrossel-2.png",
        "carrossel-3.png",
        "carrossel-4.png"
      ],
      texts: [
        "Seu treino personalizado de Tai Chi está sendo criado!",
        "O corpo muda por completo.",
        "Emagrecer é só o começo.",
        "⭐ ⭐ ⭐ ⭐ ⭐",
        "Nota 4,9 baseada em 42.489 avaliações"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_39"
    },

    {
      id: "step_39",
      index: 39,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-39-prevemos-resultado.png"],
      texts: [
        "Prevemos que você alcance 60 em 8 semanas",
        "com seu treino personalizado de Tai Chi"
      ],
      buttons: [
        { label: "Continuar", kind: "next", destination: "next" }
      ],
      next: "step_40"
    },

    {
      id: "step_40",
      index: 40,
      stepType: "content",
      logo: "logo-harno.png",
      images: ["step-40-caminho-simples.png"],
      texts: [
        "Criamos um caminho simples para você praticar Tai Chi:",
        "Todas as aulas são em vídeo, explicadas passo a passo, com movimentos claros e fáceis de acompanhar mesmo para quem nunca praticou antes.",
        "Após finalizar sua inscrição, você recebe o acesso ao seu aplicativo imediatamente por e-mail e whatsapp.",
        "O aplicativo é simples e intuitivo, ideal até para quem não tem experiência com tecnologia.",
        "✅ É só apertar o play, seguir a aula e evoluir aos poucos, dia após dia."
      ],
      buttons: [
        { label: "EU QUERO COMEÇAR AGORA! 💪", kind: "redirect", destination: "venda.html" }
      ],
      next: null
    }
  ]
};