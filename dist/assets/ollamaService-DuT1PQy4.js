import{h as C,S as L}from"./index-D1_ERkRS.js";import{s as J}from"./vendor-ocr-DZw5WN6f.js";let F=null;async function _(){return F||(F=(async()=>{try{return await J.createWorker("eng")}catch(a){return console.warn("[OCR Worker Init Failed]",a),null}})()),F}async function B(a,t){return typeof window>"u"||!a.startsWith("data:image")?a:new Promise(e=>{const o=new Image;o.crossOrigin="anonymous",o.onload=()=>{const l=document.createElement("canvas"),i=l.getContext("2d");if(!i){e(a);return}const m=1200;let c=o.width,r=o.height;(c>m||r>m)&&(c>r?(r=Math.round(r*m/c),c=m):(c=Math.round(c*m/r),r=m)),t===90||t===270?(l.width=r,l.height=c):(l.width=c,l.height=r),i.save(),t===90?(i.translate(r,0),i.rotate(90*Math.PI/180)):t===270?(i.translate(0,c),i.rotate(270*Math.PI/180)):t===180&&(i.translate(c,r),i.rotate(180*Math.PI/180)),i.drawImage(o,0,0,c,r),i.restore(),e(l.toDataURL("image/jpeg",.9))},o.onerror=()=>e(a),o.src=a})}async function Q(a){const t=C.get(L.EQUIPAMENTOS),e=C.get(L.PECAS_CATALOGO);try{const o=await _();if(!o)return{rawText:"",confidence:0};const l=await B(a,0);let m=(await o.recognize(l)).data.text||"";if(!/(?:[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}|HA-\d+|REF|FIL|GRAUMP|CAVILHA|INDICADOR)/i.test(m)){const s=await B(a,90),M=(await o.recognize(s)).data.text||"";m=`${m}
${M}`}const r=m.split(`
`).map(s=>s.trim()).filter(Boolean);let p,h,v,$;const u=/\b([A-Z]{1,5}-\d{2,4}-\d{2,4}|[A-Z]{2,5}-\d{3,8}|[A-Z]{2,4}\d{4,8})\b/gi,T=m.match(u);T&&T.length>0&&(h=T[0].toUpperCase());for(const s of r){const f=s.toUpperCase();if((f.includes("CAVILHA")||f.includes("INDICADOR")||f.includes("FILTRO")||f.includes("PASTILHA")||f.includes("ESCOVA")||f.includes("CORREIA")||f.includes("BOMBA")||f.includes("OLEO")||f.includes("ÓLEO")||f.includes("VALVULA")||f.includes("VÁLVULA"))&&!f.includes("GRAUMP")&&f.length>=4){v=s.replace(/GRAUMP[^a-zA-Z0-9]*/gi,"").trim();break}}const I=s=>{if(!s)return!1;const f=s.replace(/[^A-Z0-9]/g,"").toUpperCase();return f.length!==6?!1:/^(?:[A-Z]{2}\d{4}|\d{4}[A-Z]{2}|\d{2}[A-Z]{2}\d{2}|[A-Z]{2}\d{2}[A-Z]{2}|\d{2}[A-Z]{2}[A-Z]{2})$/.test(f)},n=/\b([0-9A-Z]{2}[-\s.][0-9A-Z]{2}[-\s.][0-9A-Z]{2})\b/gi,g=m.match(n);if(g&&g.length>0)for(const s of g){const f=s.replace(/[\s.]/g,"-").toUpperCase();if(f.length===8&&I(f)&&(!h||!h.includes(f.replace(/-/g,"")))){p=f;break}}const A=p?U(p,t):void 0,P=h||v?z(h,v,e):void 0;return(h||v)&&!A&&(p=void 0),{rawText:m,detectedPlate:(A==null?void 0:A.matricula)||(p?D(p):void 0),matchedEquipment:A,detectedPartRef:(P==null?void 0:P.referencia)||h,detectedPartName:(P==null?void 0:P.designacao)||v,matchedPart:P,odometerKm:$,confidence:A||P?.98:.85}}catch(o){return console.warn("[Local OCR Worker Error]",o),{rawText:"",confidence:0}}}async function Y(a){const t=new Promise(e=>setTimeout(()=>e({rawText:"",confidence:0}),6e3));return Promise.race([Q(a),t])}function b(a){return a?a.replace(/[^a-zA-Z0-9]/g,"").toUpperCase():""}function D(a){const t=b(a);return t.length===6?`${t.slice(0,2)}-${t.slice(2,4)}-${t.slice(4,6)}`:a.trim().toUpperCase()}function ee(a,t){const e=[];for(let o=0;o<=t.length;o++)e[o]=[o];for(let o=0;o<=a.length;o++)e[0][o]=o;for(let o=1;o<=t.length;o++)for(let l=1;l<=a.length;l++)t.charAt(o-1)===a.charAt(l-1)?e[o][l]=e[o-1][l-1]:e[o][l]=Math.min(e[o-1][l-1]+1,e[o][l-1]+1,e[o-1][l]+1);return e[t.length][a.length]}function U(a,t){if(!a)return;const e=t&&t.length>0?t:C.get(L.EQUIPAMENTOS);if(!e||e.length===0)return;const o=b(a);if(!o)return;const l=e.find(r=>b(r.matricula)===o);if(l)return l;const i=e.find(r=>{const p=b(r.matricula);return p.includes(o)||o.length>=5&&o.includes(p)});if(i)return i;let m,c=999;for(const r of e){const p=b(r.matricula),h=ee(o,p);h<=2&&h<c&&(c=h,m=r)}return m}function z(a,t,e){const o=e&&e.length>0?e:C.get(L.PECAS_CATALOGO);if(!o||o.length===0)return;const l=a?a.replace(/[^a-zA-Z0-9]/g,"").toUpperCase():"",i=t?t.toLowerCase().trim():"";if(l&&l.length>=3){const m=o.find(r=>r.referencia.replace(/[^a-zA-Z0-9]/g,"").toUpperCase()===l);if(m)return m;const c=o.find(r=>{const p=r.referencia.replace(/[^a-zA-Z0-9]/g,"").toUpperCase();return p.includes(l)||l.includes(p)});if(c)return c}if(i&&i.length>=3){const m=o.find(r=>r.designacao.toLowerCase().includes(i)||i.includes(r.designacao.toLowerCase()));if(m)return m;const c=i.split(/\s+/).filter(r=>r.length>2);if(c.length>0){const r=o.find(p=>{const h=p.designacao.toLowerCase();return c.every(v=>h.includes(v))});if(r)return r}}}async function j(a,t=1024,e=.85){return typeof window>"u"||!a||!a.startsWith("data:image")?a:new Promise(o=>{const l=new Image;l.crossOrigin="anonymous",l.onload=()=>{let i=l.width,m=l.height;(i>t||m>t)&&(i>m?(m=Math.round(m*t/i),i=t):(i=Math.round(i*t/m),m=t));const c=document.createElement("canvas");c.width=i,c.height=m;const r=c.getContext("2d");if(!r){o(a);return}r.drawImage(l,0,0,i,m);const p=c.toDataURL("image/jpeg",e);o(p)},l.onerror=()=>o(a),l.src=a})}async function ne(a,t="geral"){const e=Date.now(),o=C.getConfig(),l=(o.ollamaUrl||"https://oficina-hp-ollama.l1mamt.easypanel.host").trim().replace(/\/+$/,""),i=o.ollamaModel||"minicpm-v",c=(await j(a,1024,.85)).replace(/^data:image\/[a-z]+;base64,/,""),r=C.get(L.EQUIPAMENTOS),p=r.map(u=>u.matricula).filter(Boolean),h=C.get(L.PECAS_CATALOGO),v=h.slice(0,40).map(u=>`${u.referencia} (${u.designacao})`);let $="";t==="matricula"?$=`És um leitor OCR de alta precisão especializado em matrículas de veículos em Portugal e Europa.
Analisa a fotografia e extrai a matrícula exata visível.

Matrículas registadas na base de dados da oficina:
[${p.join(", ")}]

Instruções:
- Formato comum em Portugal: XX-XX-XX (ex: 00-AA-00, AA-00-AA, 00-00-AA).
- Se a matrícula na imagem corresponder ou for idêntica a uma das matrículas da base de dados, usa exatamente a matrícula oficial registada.
- Extrai também a marca e modelo se forem visíveis.

Responde ESTRITAMENTE em formato JSON:
{
  "matricula": "XX-XX-XX",
  "marca": "Nome da marca se visível",
  "modelo": "Nome do modelo se visível",
  "tipo": "Ligeiro/Pesado/Máquina/Outro",
  "confianca": 0.95
}`:t==="odometro"?$=`Analisa a imagem do painel, mostrador ou contador do veículo/máquina.
Extrai o valor numérico de quilómetros (Km) e/ou horas de trabalho (Horas) visível no visor.
Responde estritamente em formato JSON:
{
  "odometroKm": 123450,
  "odometroHoras": 2340,
  "confianca": 0.90
}`:t==="peca"?$=`És um especialista em peças mecânicas e industriais de oficina.
Analisa a imagem da peça, embalagem ou etiqueta de referência. Lê mesmo texto na vertical ou rodado.

Catálogo de peças registadas na oficina:
[${v.join(", ")}]

Instruções:
- Lê com precisão qualquer código, referência gravada (ex: HA-149-617, HA-106-074, Bosch, Mahle) ou etiqueta.
- Se a peça na imagem corresponder a um item do catálogo acima, utiliza exatamente a referência e designação do catálogo.

Responde ESTRITAMENTE em formato JSON:
{
  "referencia": "Código da peça",
  "designacao": "Nome da peça",
  "confianca": 0.95
}`:$=`Analisa a fotografia geral de manutenção do veículo ou equipamento.
Extrai todas as informações visíveis: matrícula, odómetro, peças e anomalias.
Responde estritamente em formato JSON:
{
  "matricula": "",
  "tipo": "Ligeiro/Pesado/Máquina",
  "marcaModelo": "",
  "odometroKm": 0,
  "odometroHoras": 0,
  "numeroSerie": "",
  "pecasSugeridas": [],
  "referenciaPeca": "",
  "designacaoPeca": "",
  "anomaliasVisuais": [],
  "textoExtraido": "Todo o texto legível",
  "confianca": 0.9
}`;try{const u=new AbortController,T=setTimeout(()=>u.abort(),6e4),I=await fetch(`${l}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:i,prompt:$,images:[c],stream:!1,format:"json",options:{temperature:0,num_predict:400}}),signal:u.signal});if(clearTimeout(T),!I.ok)throw new Error(`Ollama Server HTTP ${I.status}`);const n=await I.json(),g=JSON.parse(n.response||"{}");let A=g.matricula||g.plate||g.Matrícula||"",P;A&&(P=U(A,r),P?A=P.matricula:A=D(A));let s=g.referencia||g.referenciaPeca||g.referência||g.ref,f=g.designacao||g.designacaoPeca||g.designação||g.descricao;const M=z(s,f,h);return M&&(s=M.referencia,f=M.designacao),{sucesso:!0,matricula:A||void 0,odometroKm:typeof g.odometroKm=="number"&&g.odometroKm>0?g.odometroKm:void 0,odometroHoras:typeof g.odometroHoras=="number"&&g.odometroHoras>0?g.odometroHoras:void 0,tipoEquipamento:(P==null?void 0:P.tipo)||g.tipo||g.tipoEquipamento,marcaModelo:P?`${P.marca} ${P.modelo}`:g.marcaModelo||(g.marca?`${g.marca} ${g.modelo||""}`.trim():void 0),numeroSerie:(P==null?void 0:P.nSerie)||g.numeroSerie,pecasSugeridas:f?[f]:g.pecasSugeridas||[],anomaliasVisuais:g.anomaliasVisuais||[],textoExtraido:g.textoExtraido||n.response,confianca:g.confianca||.9,tempoProcessamentoMs:Date.now()-e,origem:"ollama",imagemBase64:a}}catch(u){return console.warn("[Ollama Vision Error]",(u==null?void 0:u.message)||u),ae(a,t,e)}}function ae(a,t,e){return{sucesso:!1,confianca:0,tempoProcessamentoMs:Date.now()-e,origem:"ocr_local",imagemBase64:a,textoExtraido:"Não foi possível contactar o servidor Ollama ou imagem sem texto legível."}}async function ce(a,t){if(!a||a.trim().length===0)return{hasActionableTask:!1};const e=C.getConfig(),o=e.ollamaUrl||"http://127.0.0.1:11434",l=e.ollamaModel||"llama3.2:latest",m=`Tu és um assistente inteligente de gestão de oficina mecânica e frotas.
Analisa o seguinte texto escrito no campo "NOTAS INTERNAS" de uma Folha de Serviço.
Contexto da folha: ${t?`Folha de Serviço: ${t.numeroFolha||"N/A"}, Viatura/Matrícula: ${t.matricula||"N/A"}, Empresa: ${t.nomeEmpresa||"N/A"}`:""}

Texto das Notas Internas:
"""
${a}
"""

Instruções:
1. Avalia se o texto contém alguma AÇÃO/TAREFA pendente ou ordem de criação de tarefa (exemplos: "cria uma tarefa...", enviar peça, enviar orçamento, entrar em contacto, ligar, encomendar peça, agendar visita, fazer teste de estrada, etc.).
2. Se houver frases entre aspas ou um pedido expresso de ação, extrai a ação concreta e limpa para "descricao".
3. Se indicar um prazo ou dia (ex: "amanhã" = 1 dia, "hoje" = 0 dias, "semana" = 7 dias), define "diasLimite".
4. Se mencionar um responsável específico (ex: "Gil", "Hugo Portugal"), define "responsavel".
5. Se solicitar seguimento/alerta (ex: "mandar email a perguntar se foi feito"), inclui em "seguimento".
6. Se SIM (é uma tarefa/ação concreta), define:
   - "hasActionableTask": true
   - "descricao": descrição clara e direta da tarefa
   - "prioridade": uma de "Crítica", "Urgente", "Alta", "Normal", "Baixa"
   - "responsavel": nome do responsável (ex: "Gil", "Hugo Portugal")
   - "diasLimite": número de dias a contar de hoje (ex: 1 para amanhã, 2 para normal)
   - "razao": breve explicação
   - "seguimento": nota sobre seguimento/email se solicitado

Responde EXCLUSIVAMENTE em formato JSON:
{
  "hasActionableTask": true,
  "descricao": "Descrição da tarefa",
  "prioridade": "Normal",
  "responsavel": "Hugo Portugal",
  "diasLimite": 1,
  "razao": "A nota indica ação a realizar",
  "seguimento": "Enviar email de confirmação se pendente"
}`;try{const c=new AbortController,r=setTimeout(()=>c.abort(),6e3),p=await fetch(`${o}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:l,prompt:m,stream:!1,format:"json"}),signal:c.signal});if(clearTimeout(r),p.ok){const h=await p.json(),v=JSON.parse(h.response||"{}");if(v.hasActionableTask&&v.descricao){const $=typeof v.diasLimite=="number"?v.diasLimite:2,u=new Date(Date.now()+$*24*60*60*1e3).toISOString().split("T")[0],T=v.seguimento?`

📧 Acompanhamento: ${v.seguimento}`:"";return{hasActionableTask:!0,tarefa:{descricao:v.descricao,prioridade:["Crítica","Urgente","Alta","Normal","Baixa"].includes(v.prioridade)?v.prioridade:"Normal",responsavel:v.responsavel||"Hugo Portugal",dataLimite:u,notasAdicionais:`Gerada via IA pelas Notas Internas da FS ${(t==null?void 0:t.numeroFolha)||""} (${(t==null?void 0:t.matricula)||""}).
Nota original: "${a}"${T}`},razao:v.razao}}}}catch{}return oe(a,t)}function oe(a,t){const e=a.toLowerCase(),o=t!=null&&t.numeroFolha?`[FS ${t.numeroFolha}${t.matricula?` - ${t.matricula}`:""}]`:"",l=a.match(/["']([^"']{5,})["']/),i=l?l[1].trim():"";let m=2;e.includes("hoje")?m=0:e.includes("amanhã")||e.includes("amanha")||e.includes("urgente")||e.includes("imediato")?m=1:e.includes("semana")&&(m=7);const c=new Date(Date.now()+m*24*60*60*1e3).toISOString().split("T")[0];let r="Hugo Portugal";e.includes("gil")&&(r="Gil");let p="";if((e.includes("email")||e.includes("perguntar se foi feito")||e.includes("não tenha sido")||e.includes("nao tenha sido"))&&(p=`

📧 Acompanhamento: Solicitado envio de email a verificar conclusão caso a tarefa permaneça pendente.`),e.includes("cria tarefa")||e.includes("cries uma tarefa")||e.includes("criar tarefa")||e.includes("criar uma tarefa")||e.includes("nova tarefa")||e.includes("gerar tarefa")||e.includes("lembrete")||e.includes("lembrar")){const h=i||a.replace(/Quero que cries uma tarefa.*?[.:]/i,"").trim();return{hasActionableTask:!0,tarefa:{descricao:`${h.length>5?h:`Acompanhar assunto da FS ${(t==null?void 0:t.numeroFolha)||""}`} ${o}`.trim(),prioridade:e.includes("urgente")?"Urgente":"Normal",responsavel:r,dataLimite:c,notasAdicionais:`Gerado a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada instrução explícita de criação de tarefa nas Notas Internas."}}if(e.includes("orçamento")||e.includes("orcamento")||e.includes("proposta")||e.includes("cotacao")||e.includes("cotação")){const h=e.includes("urgente")||e.includes("rapido")||e.includes("hoje");return{hasActionableTask:!0,tarefa:{descricao:`Elaborar e enviar orçamento ${o}`.trim(),prioridade:h?"Urgente":"Alta",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada necessidade de orçamentação ou cotação."}}if(e.includes("encomendar")||e.includes("pedir peca")||e.includes("pedir peça")||e.includes("comprar")||e.includes("falta peça")||e.includes("falta peca")){const h=e.includes("urgente")||e.includes("imediato");return{hasActionableTask:!0,tarefa:{descricao:`Encomendar peças/material ${o}`.trim(),prioridade:h?"Urgente":"Alta",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada necessidade de encomenda de peças ou material."}}return e.includes("enviar peça")||e.includes("enviar peca")||e.includes("enviar material")||e.includes("despachar")||e.includes("levar")?{hasActionableTask:!0,tarefa:{descricao:`Enviar/Expedir peças para cliente/estaleiro ${o}`.trim(),prioridade:"Urgente",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada necessidade de envio ou entrega de peças."}:e.includes("ligar")||e.includes("contactar")||e.includes("contacto")||e.includes("telefonar")||e.includes("avisar cliente")?{hasActionableTask:!0,tarefa:{descricao:`${i||(e.includes("contacto")?"Entrar em contacto com cliente/responsável":"Contactar cliente/responsável")} ${o}`.trim(),prioridade:"Alta",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada necessidade de comunicação ou contacto com o cliente/entidade."}:e.includes("agendar")||e.includes("marcar")||e.includes("ir ao estaleiro")||e.includes("deslocacao")||e.includes("deslocação")?{hasActionableTask:!0,tarefa:{descricao:`Agendar intervenção / deslocação ${o}`.trim(),prioridade:"Normal",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada necessidade de agendamento ou intervenção presencial."}:e.includes("verificar")||e.includes("testar")||e.includes("reparar")||e.includes("substituir")||e.includes("trocar")?{hasActionableTask:!0,tarefa:{descricao:`Verificação técnica pendente ${o}`.trim(),prioridade:"Normal",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetada ação técnica pendente."}:e.includes("precisa")||e.includes("tem de")||e.includes("tem que")||e.includes("fazer")||e.includes("pendente")?{hasActionableTask:!0,tarefa:{descricao:`${a.slice(0,70)} ${o}`.trim(),prioridade:"Normal",responsavel:r,dataLimite:c,notasAdicionais:`Gerado automaticamente a partir das Notas Internas:
"${a}"${p}`},razao:"Detetado item de ação nas notas internas."}:{hasActionableTask:!1}}async function te(a,t=0){const e=C.getConfig(),o=(e.ollamaUrl||"https://oficina-hp-ollama.l1mamt.easypanel.host").trim().replace(/\/+$/,""),l=e.ollamaModel||"minicpm-v";let i=null;try{i=await Y(a)}catch(u){console.warn("[Local OCR Scan Error]",u)}const c=(await j(a,1024,.85)).replace(/^data:image\/[a-z]+;base64,/,""),r=C.get(L.EQUIPAMENTOS),p=r.map(u=>u.matricula).filter(Boolean),h=C.get(L.PECAS_CATALOGO),v=h.slice(0,40).map(u=>`${u.referencia} (${u.designacao})`),$=`És um sistema perito de visão computacional de oficina mecânica e frotas industriais.
Analisa a fotografia e CLASSIFICA-A AUTOMATICAMENTE num dos seguintes tipos:
1. "matricula" se a foto for focada na matrícula (mesmo em fundo amarelo/branco) ou frente/traseira de um veículo/máquina.
2. "odometro" se a foto for do mostrador de quilómetros (Km) ou contador de horas (Horas).
3. "peca" se a foto for de uma peça mecânica, cavilha, autocolante, etiqueta adesiva, consumível, filtro ou código de referência (ex: HA-XXX-XXX).
4. "dano" se a foto mostrar uma avaria, peça partida, desgaste excessivo ou fuga.
5. "geral" se for uma foto geral da viatura.

ATENÇÃO CRÍTICA:
- O texto na etiqueta ou peça pode estar na vertical, de lado ou rodado a 90 graus (ao longo de tubos, cilindros ou autocolantes brancos). Lê atentamente em todas as direções.
- Se a matrícula for amarela ou branca portuguesa (ex: 72-TZ-38), extrai os 6 carateres com traços.

Base de dados da oficina:
- Matrículas conhecidas: [${p.join(", ")}]
- Peças no catálogo: [${v.join(", ")}]

Responde ESTRITAMENTE em formato JSON:
{
  "tipoDetectado": "matricula" | "odometro" | "peca" | "dano" | "geral",
  "matricula": "XX-XX-XX",
  "marcaModelo": "Marca e Modelo se visível",
  "odometroKm": 0,
  "odometroHoras": 0,
  "referenciaPeca": "Código/Referência",
  "designacaoPeca": "Nome da peça",
  "anomaliasVisuais": ["Dano ou avaria visível"],
  "descricaoBreve": "Resumo em português do que está na foto",
  "confianca": 0.95
}`;try{const u=new AbortController,T=setTimeout(()=>u.abort(),6e4);let I=await fetch(`${o}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:l,prompt:$,images:[c],stream:!1,format:"json",options:{temperature:0,num_predict:400}}),signal:u.signal});I.status===404&&l!=="minicpm-v"&&(console.warn(`[Ollama Model ${l} 404, falling back to minicpm-v]`),I=await fetch(`${o}/api/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"minicpm-v",prompt:$,images:[c],stream:!1,format:"json",options:{temperature:0,num_predict:400}}),signal:u.signal})),clearTimeout(T);let n={};if(I.ok){const N=await I.json();try{n=JSON.parse(N.response||"{}")}catch{n={}}}const g=n.matricula||n.plate||n.Matrícula||n.license_plate||"",A=n.referenciaPeca||n.referencia||n.referência||n.ref||"",P=n.designacaoPeca||n.designacao||n.designação||n.descricao||"";let s=(i==null?void 0:i.detectedPartRef)||A,f=(i==null?void 0:i.detectedPartName)||P;const M=z(s,f,h);M&&(s=M.referencia,f=M.designacao);let w=(i==null?void 0:i.detectedPlate)||g,H=i!=null&&i.matchedEquipment?`${i.matchedEquipment.marca} ${i.matchedEquipment.modelo}`:n.marcaModelo;if(w){const N=w.toUpperCase();(N.startsWith("HA-")||N.startsWith("FIL-")||N.startsWith("REF-")||s&&s.includes(N.replace(/-/g,"")))&&(s||(s=w),w="")}if(w){const N=U(w,r);N?(w=N.matricula,H=`${N.marca} ${N.modelo}`):w=D(w)}let S=n.tipoDetectado||"geral";s||f||n.tipoDetectado==="peca"?(S="peca",U(w,r)||(w="")):w&&w.length>=6?S="matricula":n.odometroKm>0||n.odometroHoras>0||i!=null&&i.odometerKm||n.tipoDetectado==="odometro"?S="odometro":n.anomaliasVisuais&&n.anomaliasVisuais.length>0||n.tipoDetectado==="dano"?S="dano":S=n.tipoDetectado||"geral";const y={matricula:"🚗 Matrícula",odometro:"⏱️ Odómetro / Horas",peca:"🔩 Peça / Material",dano:"⚠️ Dano / Anomalia",geral:"📸 Vista Geral"};return{imagemBase64:a,tipoDetectado:S,labelTipo:y[S]||"📸 Foto",matricula:w,marcaModelo:H,odometroKm:typeof n.odometroKm=="number"&&n.odometroKm>0?n.odometroKm:i==null?void 0:i.odometerKm,odometroHoras:typeof n.odometroHoras=="number"&&n.odometroHoras>0?n.odometroHoras:void 0,referenciaPeca:s,designacaoPeca:f,anomaliasVisuais:Array.isArray(n.anomaliasVisuais)?n.anomaliasVisuais:void 0,descricaoBreve:n.descricaoBreve||(w?`Matrícula: ${w}`:f?`Peça: ${s?`[${s}] `:""}${f}`:`${y[S]} identificada`),confianca:w||s?.98:n.confianca||.9}}catch(u){return console.warn("[Classify Image Error, using Local OCR Fallback]",(u==null?void 0:u.message)||u),ie(a,t,i)}}function ie(a,t,e){return e!=null&&e.detectedPlate?{imagemBase64:a,tipoDetectado:"matricula",labelTipo:"🚗 Matrícula",matricula:e.detectedPlate,marcaModelo:e.matchedEquipment?`${e.matchedEquipment.marca} ${e.matchedEquipment.modelo}`:void 0,descricaoBreve:`Matrícula: ${e.detectedPlate}`,confianca:.98}:e!=null&&e.detectedPartRef||e!=null&&e.detectedPartName?{imagemBase64:a,tipoDetectado:"peca",labelTipo:"🔩 Peça / Material",referenciaPeca:e.detectedPartRef,designacaoPeca:e.detectedPartName,descricaoBreve:`Peça: ${e.detectedPartRef?`[${e.detectedPartRef}] `:""}${e.detectedPartName||""}`.trim(),confianca:.95}:{imagemBase64:a,tipoDetectado:"geral",labelTipo:"📸 Vista Geral",descricaoBreve:`Fotografia ${t+1} anexada`,confianca:.7}}async function de(a){const t=C.getConfig(),e=C.generateSequenceNumber(L.FOLHAS_SERVICO,"FS"),o=new Date().toISOString().split("T")[0],l=a.equipamentos&&a.equipamentos.length>0?a.equipamentos:C.get(L.EQUIPAMENTOS),i=a.empresas&&a.empresas.length>0?a.empresas:C.get(L.EMPRESAS),m=C.get(L.PECAS_CATALOGO);let c="",r="",p="",h="Ligeiro",v=0,$=0;const u=[],T=[],I=[],n=[],g=[];a.fotos&&a.fotos.length>0&&n.push(...a.fotos),a.fotoMatricula&&!n.includes(a.fotoMatricula)&&n.push(a.fotoMatricula),a.fotoOdometro&&!n.includes(a.fotoOdometro)&&n.push(a.fotoOdometro),a.fotosPecas&&a.fotosPecas.forEach(d=>{n.includes(d)||n.push(d)}),a.fotosGerais&&a.fotosGerais.forEach(d=>{n.includes(d)||n.push(d)});const A=a.textoDescritivo||"";if(A){for(const d of l)if(A.toUpperCase().includes(b(d.matricula))||A.toUpperCase().includes(d.matricula.toUpperCase())){c=d.matricula,r=d.marca,p=d.modelo,h=d.tipo;break}}const P=await Promise.all(n.map((d,R)=>te(d,R)));for(const d of P){if(g.push(d),d.matricula&&!c&&(c=d.matricula,d.marcaModelo)){const R=d.marcaModelo.split(" ");r=R[0]||"",p=R.slice(1).join(" ")||""}if(d.odometroKm&&d.odometroKm>0&&v===0&&(v=d.odometroKm),d.odometroHoras&&d.odometroHoras>0&&$===0&&($=d.odometroHoras),d.referenciaPeca||d.designacaoPeca){const R=d.referenciaPeca||"PEC-IA",V=d.designacaoPeca||"Peça Identificada",E=z(R,V,m),K=(E==null?void 0:E.referencia)||R,q=(E==null?void 0:E.designacao)||V,G=(E==null?void 0:E.precoVenda)||0;u.some(x=>x.referencia===K&&x.designacao===q)||u.push({id:C.generateId("pec"),referencia:K,designacao:q,qtd:1,precoUnitario:G>0?G:void 0,concluido:!1,isLivre:!E})}d.anomaliasVisuais&&d.anomaliasVisuais.length>0&&I.push(...d.anomaliasVisuais)}if(A)for(const d of m)(A.toLowerCase().includes(d.designacao.toLowerCase())||A.toUpperCase().includes(d.referencia.toUpperCase()))&&(u.some(R=>R.referencia===d.referencia)||u.push({id:C.generateId("pec"),referencia:d.referencia,designacao:d.designacao,qtd:1,precoUnitario:d.precoVenda,concluido:!1,isLivre:!1}));const s=U(c,l),f=s?i.find(d=>d.id===s.empresaId):i[0],M=(s==null?void 0:s.matricula)||(c?D(c):""),w=(s==null?void 0:s.marca)||r||"",H=(s==null?void 0:s.modelo)||p||"";s!=null&&s.tipo;const S=v>0?v:(s==null?void 0:s.kmsAtuais)||0,y=$>0?$:(s==null?void 0:s.horasAtuais)||0;(A.toLowerCase().includes("óleo")||A.toLowerCase().includes("revisão")||u.some(d=>d.designacao.toLowerCase().includes("óleo")||d.designacao.toLowerCase().includes("filtro")))&&T.push({id:C.generateId("srv"),descricao:"Mudança de óleo do motor e substituição de filtros",horas:1.5,valorHora:t.valorHoraPadrao||45,concluido:!1,tecnico:"Hugo Portugal"}),(A.toLowerCase().includes("trav")||u.some(d=>d.designacao.toLowerCase().includes("trav")||d.designacao.toLowerCase().includes("pastilha"))||I.some(d=>d.toLowerCase().includes("trav")||d.toLowerCase().includes("pastilha")))&&T.push({id:C.generateId("srv"),descricao:"Substituição de pastilhas/discos de travão e purga",horas:2,valorHora:t.valorHoraPadrao||45,concluido:!1,tecnico:"Hugo Portugal"}),T.length===0&&T.push({id:C.generateId("srv"),descricao:A?`Manutenção: ${A.slice(0,60)}`:"Inspeção mecânica geral e diagnóstico",horas:1.5,valorHora:t.valorHoraPadrao||45,concluido:!1,tecnico:"Hugo Portugal"});const N=[...I,...A?[A]:[]].join("; "),O=a.tipoServico||"Oficina",k=O==="Oficina",X=k?"OF - Com requisição - Aguardar agenda":O==="Assistência Técnica"?"AT - Pedido de Assistência":O==="Contrato"?"CT - Contrato":"OF - Com requisição - Aguardar agenda",Z={id:C.generateId("fs"),numero:e,tipo:O,data:o,dataEntradaOficina:k?o:void 0,status:X,empresaId:(f==null?void 0:f.id)||(s==null?void 0:s.empresaId)||"",equipamentoId:(s==null?void 0:s.id)||"",matricula:M,marca:w,modelo:H,kmsAtuais:S,horasAtuais:y,localizacao:k?"GRAUMP (Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha)":(f==null?void 0:f.moradaSede)||"Cliente",localizacaoTipo:k?"oficina":"sede",distanciaKms:0,anomalias:N||"Diagnóstico e manutenção geral.",servicos:T,servicosAdicionais:[],pecas:u,pecasAdicionais:[],mensagens:[{id:C.generateId("msg"),user:"Assistente IA Mobile (Ollama)",text:`Folha gerada a partir de ${n.length} foto(s) com correspondência à base de dados da oficina.`,time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}],fotos:n,fotosCliente:[],notasCliente:A||"Serviço de manutenção com peças e componentes inspecionados.",notasInternas:`[Criada via IA] Matrícula: ${M||"N/A"}. Odómetro: ${S} Kms (${y} H). ${A?`Notas: "${A}"`:""}`,previsaoRevisaoKms:S>0?S+15e3:void 0,previsaoRevisaoHoras:y>0?y+500:void 0,equipamentoFuncionando:"Sim",equipamentoOperacional:"Sim",equipamentoFinalizado:"Não"},W=`Folha ${e} gerada para ${M||"Viatura"} (${S} Kms) com ${T.length} serviço(s) e ${u.length} peça(s) reconhecidas.`;return{sucesso:!0,folha:Z,detectedPlate:M,detectedKms:S,detectedHours:y,detectedPartsCount:u.length,analiseFotos:g,resumoIA:W,origem:"ollama"}}export{ce as a,ne as p,de as t};
