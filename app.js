"use strict";

/* Utilitários */
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const uid = () => globalThis.crypto?.randomUUID?.() ||
  "d"+Date.now()+Math.random().toString(16).slice(2);
const sum = (rows,key) => rows.reduce((total,row) =>
  total + (Number(typeof key==="function" ? key(row) : row[key]) || 0), 0);
const money = value => new Intl.NumberFormat("pt-BR",{
  style:"currency",currency:"BRL"
}).format(Number(value)||0);
const num = value => new Intl.NumberFormat("pt-BR",{
  maximumFractionDigits:1
}).format(Number(value)||0);
const pct = value => num(value)+"%";
const compactMoney = value => Math.abs(value)<1000 ? money(value) :
  `<span title="${money(value)}">R$ ${num(value/(Math.abs(value)>=1000000?1000000:1000))} ${Math.abs(value)>=1000000?"mi":"mil"}</span>`;
const match = (text,query) => String(text).normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .includes(String(query).normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLowerCase());

function dateISO(offset=0){
  const date=new Date();
  date.setDate(date.getDate()+offset);
  return date.getFullYear()+"-"+
    String(date.getMonth()+1).padStart(2,"0")+"-"+
    String(date.getDate()).padStart(2,"0");
}
const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value||"") ?
  value.split("-").reverse().join("/") : "—";

function readState(key,fallback,validator){
  try{
    const value=JSON.parse(localStorage.getItem("emanueli.v1."+key));
    if(value && (!validator || validator(value))) return value;
  }catch(error){}
  return clone(fallback);
}
function saveState(key,value){
  try{
    localStorage.setItem("emanueli.v1."+key,JSON.stringify(value));
    return true;
  }catch(error){
    return false;
  }
}
let toastTimer;
function notify(message){
  const element=$("#toast");
  element.textContent=message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>element.classList.remove("visible"),3600);
}
function persist(key,value,message){
  const saved=saveState(key,value);
  notify(message+(saved?"":" O armazenamento está indisponível; a alteração vale nesta sessão."));
}
function downloadCSV(filename,headers,rows){
  const cell=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const text="\ufeff"+[headers,...rows]
    .map(row=>row.map(cell).join(";")).join("\r\n");
  const blob=new Blob([text],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify("CSV do recorte exportado.");
}
function formValues(form){
  return Object.fromEntries($$("[name]",form).map(element=>[
    element.name,
    element.type==="checkbox" ? element.checked : element.value
  ]));
}
const option=(value,label,current)=>
  `<option value="${esc(value)}" ${String(value)===String(current)?"selected":""}>${esc(label)}</option>`;
const input=(id,value="",attributes="")=>
  `<input id="${id}" name="${id}" value="${esc(value)}" ${attributes}>`;
const select=(id,options)=>
  `<select id="${id}" name="${id}">${options}</select>`;
const field=(id,label,control,wide=false)=>
  `<div class="field ${wide?"wide":""}"><label for="${id}">${label}</label>${control}</div>`;
const button=(text,action,extra="",kind="")=>
  `<button type="button" class="btn ${kind}" data-action="${action}" ${extra}>${text}</button>`;
const kpi=(label,value,sub="",accent=false)=>
  `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value ${accent?"kpi-accent":""}">${value}</div><div class="kpi-sub">${sub}</div></div>`;
const empty=message=>`<div class="empty">${message}</div>`;
const formEnd=(label="Salvar")=>
  `<p class="form-error" role="alert" tabindex="-1"></p>
   <div class="form-actions">${button("Cancelar","close")}
   <button type="submit" class="btn primary">${label}</button></div>`;
const bottom=(text="Alterações ficam neste navegador.",reset=true)=>
  `<div class="app-bottom"><span>DADOS FICTÍCIOS · ${text}</span>
   ${reset?'<button type="button" data-action="reset">Restaurar demonstração</button>':""}</div>`;

function prepare(root,brand,caption,extra=""){
  root.innerHTML=`
    <div class="app-bar">
      <div><div class="app-brand">${brand}</div><div class="app-caption">${caption}</div></div>
      ${extra||'<div class="app-user"><span>Workspace demonstrativo</span><span class="app-avatar" aria-label="Usuária de demonstração">ES</span></div>'}
    </div>
    <div class="app-body"></div>
    <dialog aria-labelledby="dialog-title"></dialog>`;
  const body=$(".app-body",root);
  const dialog=$("dialog",root);
  let opener=null;

  function draw(html){
    const active=document.activeElement;
    const id=active?.id;
    let start=null,end=null;
    try{start=active?.selectionStart;end=active?.selectionEnd;}catch(error){}
    body.innerHTML=html;
    if(id){
      const next=document.getElementById(id);
      if(next && body.contains(next)){
        next.focus({preventScroll:true});
        if(typeof start==="number" && next.setSelectionRange){
          try{next.setSelectionRange(start,end);}catch(error){}
        }
      }
    }
  }
  function close(){
    if(dialog.open){
      dialog.close();
      if(opener?.isConnected) opener.focus({preventScroll:true});
    }
  }
  function modal(title,html){
    if(!dialog.open) opener=document.activeElement;
    dialog.innerHTML=`
      <div class="dialog-head">
        <h3 id="dialog-title">${title}</h3>
        <button type="button" class="dialog-close" data-action="close" aria-label="Fechar janela">×</button>
      </div><div class="dialog-body">${html}</div>`;
    if(!dialog.open) dialog.showModal();
  }
  function error(message){
    const element=$(".form-error",dialog);
    if(element){element.textContent=message;element.focus();}
  }
  root.addEventListener("click",event=>{
    if(event.target.closest('[data-action="close"]')) close();
  });
  return {body,dialog,draw,modal,close,error};
}
function resetDialog(ui){
  ui.modal("Restaurar demonstração",`
    <p class="dialog-note">Os dados originais deste projeto serão restaurados. Os cadastros e alterações desta demonstração serão removidos deste navegador.</p>
    <div class="form-actions">${button("Cancelar","close")}${button("Restaurar dados","confirm-reset","","primary")}</div>`);
}

/* Conteúdo do portfólio */
const projects=[
  {
    slug:"crm",num:"01",name:"CRM comercial SaaS",brand:"northstar",
    category:"OPERAÇÃO COMERCIAL",theme:"crm",
    description:"Do primeiro contato ao negócio fechado.",
    question:"Como acompanhar oportunidades sem perder o contexto de cada negociação?",
    explanation:"Um pipeline de quatro etapas reúne empresas, valores e próximos passos. A busca e os indicadores acompanham cada alteração.",
    steps:["Cadastre uma oportunidade e defina seu valor.","Avance o negócio no pipeline ou edite seus dados.","Busque uma empresa e acompanhe os totais."],
    technologies:["HTML","CSS Grid","JavaScript","LocalStorage"],
    scope:"Protótipo de SaaS com persistência neste navegador. Não inclui autenticação, equipes ou servidor."
  },
  {
    slug:"people-analytics",num:"02",name:"People Analytics",brand:"raízes",
    category:"PESSOAS & DADOS",theme:"people",
    description:"Uma leitura clara de quem faz a operação acontecer.",
    question:"Como transformar indicadores de RH em uma leitura útil sobre as equipes?",
    explanation:"Um painel cruza departamento e período para apresentar quadro de pessoas, movimentações e engajamento com base em uma amostra fictícia.",
    steps:["Filtre por departamento e trimestre.","Compare a evolução do quadro e o engajamento.","Exporte os dados do recorte em CSV."],
    technologies:["HTML","CSS","JavaScript","CSV"],
    scope:"Análise descritiva de dados fictícios agregados. Sem informações de funcionários reais ou conexão com ferramentas de RH."
  },
  {
    slug:"chamados",num:"03",name:"Central de chamados",brand:"helpgrid",
    category:"SERVIÇOS DE TI",theme:"tickets",
    description:"Solicitações organizadas. Atendimento em movimento.",
    question:"Como tornar visíveis as prioridades e o andamento do atendimento de TI?",
    explanation:"Uma fila de solicitações conecta assunto, prioridade, responsável, histórico e status em um fluxo de atendimento.",
    steps:["Abra um chamado com assunto e prioridade.","Filtre a fila e abra os detalhes de um atendimento.","Atualize o status e registre uma nota no histórico."],
    technologies:["HTML","CSS","JavaScript","LocalStorage"],
    scope:"Simulação local de service desk. Os chamados não são enviados a uma equipe real."
  },
  {
    slug:"ecommerce",num:"04",name:"E-commerce",brand:"forma.",
    category:"COMÉRCIO DIGITAL",theme:"shop",
    description:"Matéria, função e uma experiência de compra.",
    question:"Como organizar um catálogo e tornar o caminho até a compra simples?",
    explanation:"Uma loja de objetos para casa combina catálogo filtrável, detalhes de produto, carrinho e fechamento de pedido demonstrativo.",
    steps:["Filtre a coleção e abra os detalhes de uma peça.","Adicione itens à sacola e altere quantidades.","Conclua um pedido fictício, sem pagamento."],
    technologies:["HTML","CSS","JavaScript","SVG","LocalStorage"],
    scope:"Loja demonstrativa. Nenhuma compra, cobrança, reserva de estoque ou entrega real é realizada. Dados do formulário não são enviados."
  },
  {
    slug:"gestao-juridica",num:"05",name:"Gestão jurídica ERP/CRM",brand:"LEXORA",
    category:"LEGAL OPERATIONS",theme:"legal",
    description:"Clientes, processos e prazos no mesmo contexto.",
    question:"Como conectar relacionamento com clientes e rotinas de um escritório jurídico?",
    explanation:"Uma área de trabalho reúne clientes, processos, prazos e honorários. O cadastro de um processo gera seu primeiro prazo e um lançamento financeiro demonstrativo.",
    steps:["Cadastre um cliente e um processo relacionado.","Atualize o processo e conclua prazos.","Registre o recebimento de honorários na visão financeira."],
    technologies:["HTML","CSS","JavaScript","LocalStorage"],
    scope:"ERP/CRM demonstrativo, sem integração com tribunais, movimentações oficiais ou dados de pessoas reais."
  },
  {
    slug:"dashboard-tributario",num:"06",name:"Dashboard tributário",brand:"NUMÉRA",
    category:"INTELIGÊNCIA DE DADOS",theme:"tax",
    description:"A operação fiscal vista pelos números.",
    question:"Como comparar valores tributários entre períodos e unidades de uma operação?",
    explanation:"Um painel soma uma base fictícia de receitas e tributos e mostra evolução, composição e participação sobre a receita. Cada filtro recalcula as visualizações.",
    steps:["Alterne o período e a unidade da base.","Compare valores mensais e composição por tributo.","Exporte o recorte analisado em CSV."],
    technologies:["HTML","CSS","JavaScript","SVG","CSV"],
    scope:"Visualização de valores fictícios previamente definidos. Não apura impostos nem fornece orientação fiscal ou tributária."
  }
];

function contactHTML(standalone=false){
  return `<section class="contact-section" id="contato">
    <div><span class="eyebrow">CONTATO</span>${standalone?'<h1>Vamos<br><em>conversar.</em></h1>':'<h2>Vamos conversar.</h2>'}</div>
    <div class="contact-links">
      <a href="mailto:souzaemanuelide@gmail.com"><span>souzaemanuelide@gmail.com</span><small>E-MAIL ↗</small></a>
      <a href="https://wa.me/5551981825633" target="_blank" rel="noopener noreferrer"><span>(51) 98182-5633</span><small>WHATSAPP ↗</small></a>
      <a href="https://www.linkedin.com/in/emanueli-de-souza-9b7164278/" target="_blank" rel="noopener noreferrer"><span>Emanueli de Souza</span><small>LINKEDIN ↗</small></a>
    </div>
  </section>`;
}
function home(){
  return `<div class="page">
    <section class="opening">
      <div class="opening-meta"><span>PORTFÓLIO / 2026</span><span>DESENVOLVIMENTO, DADOS & GESTÃO</span></div>
      <h1>Sistemas, dados<br>e <em>decisões.</em></h1>
      <div class="index-label"><span>PROJETOS SELECIONADOS</span><span>01 — 06</span></div>
    </section>
    <ol class="project-list">${projects.map(project=>`
      <li><a class="project-row" href="#/projeto/${project.slug}">
        <span class="row-number">${project.num}</span>
        <span class="row-main"><h2>${project.name}</h2><span class="row-description">${project.description}</span></span>
        <span class="row-category">${project.category}</span>
        <span class="row-arrow" aria-hidden="true">↗</span>
      </a></li>`).join("")}</ol>
    <div class="home-note"><span aria-hidden="true">*</span><p>Seis contextos de negócio.<br>Seis experiências para explorar.</p><a href="#/sobre">Conheça meu percurso ↗</a></div>
    ${contactHTML()}
  </div>`;
}
function about(){
  return `<div class="page about">
    <a class="back-link" href="#/">← Voltar ao índice</a>
    <span class="eyebrow">SOBRE / EMANUELI DE SOUZA</span>
    <h1>Entre a tecnologia<br>e o <em>negócio.</em></h1>
    <div class="about-grid">
      <p class="about-lead">Sou Emanueli de Souza, estudante de Gestão da Tecnologia da Informação. Meu interesse está na conexão entre desenvolvimento, dados, organização e processos.</p>
      <div>
        <p>Este portfólio apresenta estudos de sistemas em seis contextos de negócio. Cada projeto combina uma interface própria com operações que podem ser experimentadas diretamente no navegador.</p>
        <p>Busco oportunidades para aplicar esse repertório, aprender com equipes e contribuir para tornar a informação mais clara e as rotinas mais eficientes.</p>
        <a class="text-link" href="https://github.com/souzaemanuelide-boop" target="_blank" rel="noopener noreferrer">Acompanhe meu GitHub ↗</a>
      </div>
    </div>
    <section class="about-section">
      <h2>Formação</h2>
      <div>
        <article><span>2023 — 2027 · EM CURSO</span><h3>Gestão da Tecnologia da Informação</h3><p>Conclusão prevista: dezembro de 2027.</p></article>
        <article><span>2021 · CONCLUÍDO</span><h3>Técnico em Administração</h3></article>
        <article><span>EM CURSO</span><h3>HTML & CSS</h3></article>
      </div>
    </section>
    <section class="about-section">
      <h2>Repertório<br>em construção</h2>
      <div>
        <p>Ferramentas e linguagens que fazem parte dos meus estudos.</p>
        <ul class="technology-list">${["HTML","CSS","JavaScript","SQL","Excel","Power BI","Canva","Node.js"].map(item=>`<li>${item}</li>`).join("")}</ul>
        <p class="scope">As demonstrações deste site usam HTML, CSS e JavaScript. Os dados são fictícios; as alterações ficam no navegador utilizado.</p>
      </div>
    </section>
    ${contactHTML()}
  </div>`;
}
function projectPage(project){
  const next=projects[(projects.indexOf(project)+1)%projects.length];
  return `<section class="case-heading page">
    <a class="back-link" href="#/">← Todos os projetos</a>
    <div class="case-meta"><span>PROJETO ${project.num} / ${project.category}</span><span>ESTUDO INTERATIVO · DADOS FICTÍCIOS</span></div>
    <h1>${project.name}</h1>
    <p>${project.description}</p>
    <div class="case-jump">
      <button type="button" data-scroll="demonstracao">Explorar demonstração ↓</button>
      <button type="button" data-scroll="sobre-projeto">Sobre o projeto</button>
    </div>
  </section>
  <section class="demo-wrap" id="demonstracao" aria-label="Demonstração interativa de ${project.name}">
    <div class="demo-label page"><span>DEMONSTRAÇÃO INTERATIVA</span><span>AMBIENTE LOCAL / DADOS FICTÍCIOS</span></div>
    <div class="demo theme-${project.theme}" id="demo"></div>
  </section>
  <section class="case-study page" id="sobre-projeto">
    <div class="study-intro"><span class="eyebrow">O PROJETO / ${project.num}</span><h2>${project.question}</h2></div>
    <div class="study-detail">
      <p>${project.explanation}</p>
      <h3>Experimente</h3><ol>${project.steps.map(step=>`<li>${step}</li>`).join("")}</ol>
      <h3>Tecnologias implementadas</h3>
      <ul class="technology-list">${project.technologies.map(item=>`<li>${item}</li>`).join("")}</ul>
      <p class="scope">${project.scope}</p>
    </div>
  </section>
  <a class="next-project page" href="#/projeto/${next.slug}"><span>PRÓXIMO PROJETO</span><strong>${next.name}</strong><span aria-hidden="true">↗</span></a>`;
}

/* 01 — CRM comercial */
const stages=["Prospecção","Qualificação","Proposta","Ganho"];
const crmSeed=[
  {id:"c1",company:"Grupo Aurora",contact:"Marina Oliveira",value:12500,stage:0,note:"Apresentar solução de gestão comercial."},
  {id:"c2",company:"Órbita Tech",contact:"Rafael Lima",value:8400,stage:1,note:"Mapear quantidade de usuários."},
  {id:"c3",company:"Nexo Labs",contact:"Ana Costa",value:18600,stage:2,note:"Retorno sobre a proposta na próxima semana."},
  {id:"c4",company:"Vértice Design",contact:"Lucas Ramos",value:6200,stage:0,note:"Primeiro contato por indicação."},
  {id:"c5",company:"Atlas Digital",contact:"Bia Santos",value:15000,stage:3,note:"Proposta aprovada."},
  {id:"c6",company:"Ponto Norte",contact:"Gabriel Reis",value:9800,stage:1,note:"Agendar demonstração."}
];
function mountCRM(root){
  const ui=prepare(root,"northstar","REVENUE WORKSPACE / PIPELINE");
  let state=readState("crm",crmSeed,value=>Array.isArray(value)&&value.every(row=>
    row && typeof row.company==="string" && Number.isFinite(row.value) &&
    Number.isInteger(row.stage) && row.stage>=0 && row.stage<=3));
  let query="";

  function render(){
    const open=state.filter(row=>row.stage<3);
    const rows=state.filter(row=>match(row.company+" "+row.contact,query));
    const weighted=sum(open,row=>row.value*[.15,.4,.75][row.stage]);
    ui.draw(`
      <div class="app-heading">
        <div><div class="app-eyebrow">Vendas / Visão comercial</div><h2>Seu próximo negócio começa aqui.</h2><p>Organize oportunidades e acompanhe cada negociação.</p></div>
        ${button("+ Nova oportunidade","new-lead",'id="new-lead"',"primary")}
      </div>
      <div class="kpis">
        ${kpi("Pipeline em aberto",compactMoney(sum(open,"value")),"Todas as oportunidades abertas")}
        ${kpi("Previsão ponderada",compactMoney(weighted),"Pesos demonstrativos: 15%, 40% e 75%")}
        ${kpi("Negócios em aberto",num(open.length),"Prospecção, qualificação e proposta")}
        ${kpi("Valor ganho",compactMoney(sum(state.filter(row=>row.stage===3),"value")),"Oportunidades na etapa Ganho",true)}
      </div>
      <div class="toolbar">
        <div class="field search-field"><label for="crm-search">Buscar empresa ou contato</label>${input("crm-search",query,'type="search" placeholder="Ex.: Aurora" autocomplete="off"')}</div>
        <span class="toolbar-note">${rows.length} de ${state.length} oportunidades · Indicadores do pipeline completo</span>
      </div>
      <div class="kanban-board">${stages.map((stage,index)=>{
        const list=rows.filter(row=>row.stage===index);
        return `<section class="pipeline-column" aria-label="Etapa ${stage}">
          <div class="column-header"><span>${stage}</span><span class="column-count">${list.length}</span></div>
          <div class="column-total">${money(sum(list,"value"))}</div>
          ${list.map(row=>`<article class="lead-card ${index===3?"lead-won":""}">
            <h3>${esc(row.company)}</h3><span class="lead-contact">${esc(row.contact)}</span>
            <strong class="lead-value">${money(row.value)}</strong>
            <div class="lead-footer">
              <button type="button" data-action="edit-lead" data-id="${esc(row.id)}" id="lead-${esc(row.id)}">Ver detalhes</button>
              ${index<3?`<button type="button" class="lead-next" data-action="advance-lead" data-id="${esc(row.id)}" aria-label="Avançar ${esc(row.company)} para ${stages[index+1]}">→</button>`:'<span class="badge done">Fechado ✓</span>'}
            </div></article>`).join("")||empty("Nenhuma oportunidade nesta etapa.")}
        </section>`;
      }).join("")}</div>${bottom()}`);
  }
  function leadForm(id){
    const row=state.find(item=>item.id===id) ||
      {company:"",contact:"",value:"",stage:0,note:""};
    ui.modal(id?"Detalhes da oportunidade":"Nova oportunidade",`
      <form novalidate data-form="lead" data-id="${esc(id||"")}">
        <div class="form-grid">
          ${field("company","Empresa *",input("company",row.company,'required maxlength="80"'),true)}
          ${field("contact","Contato *",input("contact",row.contact,'required maxlength="80"'),true)}
          ${field("value","Valor do negócio (R$) *",input("value",row.value,'type="number" min="1" max="100000000" step="0.01" required inputmode="decimal"'))}
          ${field("stage","Etapa",select("stage",stages.map((value,index)=>option(index,value,row.stage)).join("")))}
          ${field("note","Próximo passo",`<textarea id="note" name="note" maxlength="800">${esc(row.note)}</textarea>`,true)}
        </div>${formEnd(id?"Salvar alterações":"Criar oportunidade")}
      </form>`);
  }
  root.addEventListener("input",event=>{
    if(event.target.id==="crm-search"){query=event.target.value;render();}
  });
  root.addEventListener("click",event=>{
    const target=event.target.closest("[data-action]");
    if(!target)return;
    const action=target.dataset.action,id=target.dataset.id;
    if(action==="new-lead")leadForm();
    if(action==="edit-lead")leadForm(id);
    if(action==="advance-lead"){
      const row=state.find(item=>item.id===id);
      if(row && row.stage<3){
        row.stage++;
        persist("crm",state,row.company+": etapa "+stages[row.stage]+".");
        render();
        document.getElementById("lead-"+id)?.focus({preventScroll:true});
      }
    }
    if(action==="reset")resetDialog(ui);
    if(action==="confirm-reset"){
      state=clone(crmSeed);query="";ui.close();
      persist("crm",state,"Pipeline restaurado.");render();
    }
  });
  root.addEventListener("submit",event=>{
    if(event.target.dataset.form!=="lead")return;
    event.preventDefault();
    const data=formValues(event.target);
    const value=Number(data.value),stage=Number(data.stage);
    if(!data.company?.trim()||!data.contact?.trim()||
      !Number.isFinite(value)||value<=0||value>1e8||
      !Number.isInteger(stage)||stage<0||stage>3){
      ui.error("Preencha empresa, contato e um valor entre R$ 1 e R$ 100 milhões.");
      return;
    }
    const id=event.target.dataset.id;
    const record={
      id:id||uid(),company:data.company.trim().slice(0,80),
      contact:data.contact.trim().slice(0,80),value,stage,
      note:(data.note||"").slice(0,800)
    };
    if(id)state=state.map(row=>row.id===id?record:row);
    else state.push(record);
    ui.close();
    persist("crm",state,id?"Oportunidade atualizada.":"Oportunidade criada.");
    render();
  });
  render();
}

/* 02 — People Analytics */
const months=["Jan","Fev","Mar","Abr","Mai","Jun"];
const departments=["Tecnologia","Operações","Comercial","Financeiro"];
const peopleData=departments.flatMap((department,index)=>months.map((month,m)=>({
  department,month,m,
  head:[42,64,35,19][index]+[0,2,3,5,6,8][m]+(index===1?m:0),
  hires:2+(m+index)%4,
  exits:(m+index)%3,
  engagement:[88,79,83,91][index]+(m%3)-1
})));
const filterPeriod=(rows,period)=>rows.filter(row=>
  period==="all"||(period==="q1"?row.m<3:row.m>=3));

function peopleSummary(rows){
  if(!rows.length)return {head:0,engagement:0,hires:0,exits:0,turnover:0};
  const last=Math.max(...rows.map(row=>row.m));
  const weight=sum(rows,"head");
  const average=weight/new Set(rows.map(row=>row.m)).size;
  return {
    head:sum(rows.filter(row=>row.m===last),"head"),
    engagement:sum(rows,row=>row.engagement*row.head)/weight,
    hires:sum(rows,"hires"),
    exits:sum(rows,"exits"),
    turnover:average?sum(rows,"exits")/average*100:0
  };
}
function mountPeople(root){
  const ui=prepare(root,"raízes","PEOPLE & CULTURE / OBSERVATÓRIO DE PESSOAS");
  let department="all",period="all";
  const filtered=()=>filterPeriod(peopleData,period)
    .filter(row=>department==="all"||row.department===department);

  function render(){
    const rows=filtered(),summary=peopleSummary(rows);
    const monthIndexes=[...new Set(rows.map(row=>row.m))];
    const heads=monthIndexes.map(m=>sum(rows.filter(row=>row.m===m),"head"));
    const maximum=Math.max(...heads,1);
    const areas=departments.filter(value=>department==="all"||value===department);
    ui.draw(`
      <div class="app-heading">
        <div><div class="app-eyebrow">Um olhar sobre as equipes</div><h2>Pessoas em perspectiva.</h2><p>Quadro, movimentações e engajamento · Janeiro a junho de 2026</p></div>
        ${button("↓ Exportar CSV","export-people")}
      </div>
      <div class="toolbar">
        ${field("people-dept","Departamento",select("people-dept",option("all","Todos os departamentos",department)+departments.map(value=>option(value,value,department)).join("")))}
        ${field("people-period","Período",select("people-period",option("all","1º semestre · 2026",period)+option("q1","1º trimestre · 2026",period)+option("q2","2º trimestre · 2026",period)))}
      </div>
      <div class="kpis">
        ${kpi("Pessoas no último mês",num(summary.head),"Quadro ativo no fim do recorte")}
        ${kpi("Engajamento médio",num(summary.engagement)+"/100","Média ponderada pelo quadro")}
        ${kpi("Admissões no período",num(summary.hires),"Movimentações registradas")}
        ${kpi("Saídas / quadro médio",pct(summary.turnover),num(summary.exits)+" desligamentos no período")}
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3 class="panel-title">Evolução do quadro de pessoas</h3>
          <p class="panel-caption">Quantidade ativa ao final de cada mês · Eixo de base zero</p>
          <div class="bar-chart" style="grid-template-columns:repeat(${monthIndexes.length},minmax(0,1fr))" role="img" aria-label="${esc(monthIndexes.map((m,index)=>months[m]+": "+heads[index]+" pessoas").join("; "))}">
            ${heads.map(value=>`<div class="bar-group"><b>${num(value)}</b><div class="bar" style="height:${value/maximum*140}px"></div></div>`).join("")}
          </div>
          <div class="bar-labels" style="grid-template-columns:repeat(${monthIndexes.length},minmax(0,1fr))">${monthIndexes.map(m=>`<span>${months[m]}</span>`).join("")}</div>
          <div class="legend"><span><i></i>Pessoas ativas</span></div>
        </section>
        <section class="panel">
          <h3 class="panel-title">Engajamento por departamento</h3>
          <p class="panel-caption">Pontuação média ponderada · Escala de 0 a 100</p>
          <div class="horizontal-bars">${areas.map(area=>{
            const value=peopleSummary(rows.filter(row=>row.department===area)).engagement;
            return `<div><div class="horizontal-bar-label"><span>${area}</span><strong>${num(value)}</strong></div><div class="horizontal-track" role="img" aria-label="${area}: ${num(value)} de 100"><span style="width:${value}%"></span></div></div>`;
          }).join("")}</div>
          <div class="people-insight"><strong>O recorte faz diferença.</strong><br>Os filtros recalculam os indicadores e as séries. Engajamento é uma média da amostra fictícia, sem avaliação individual.</div>
        </section>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Resumo por departamento, role horizontalmente se necessário">
        <table class="data-table"><thead><tr>
          <th scope="col">Departamento</th><th scope="col">Quadro final</th><th scope="col">Admissões</th><th scope="col">Saídas</th><th scope="col">Engajamento</th>
        </tr></thead><tbody>${areas.map(area=>{
          const item=peopleSummary(rows.filter(row=>row.department===area));
          return `<tr><td><strong>${area}</strong></td><td>${num(item.head)}</td><td>${num(item.hires)}</td><td>${num(item.exits)}</td><td>${num(item.engagement)} / 100</td></tr>`;
        }).join("")}</tbody></table>
      </div>${bottom("Amostra agregada de RH · 2026.",false)}`);
  }
  root.addEventListener("change",event=>{
    if(event.target.id==="people-dept")department=event.target.value;
    else if(event.target.id==="people-period")period=event.target.value;
    else return;
    render();notify("Indicadores de pessoas atualizados.");
  });
  root.addEventListener("click",event=>{
    if(event.target.closest('[data-action="export-people"]')){
      downloadCSV("raizes-pessoas.csv",
        ["Departamento","Mês","Quadro","Admissões","Saídas","Engajamento"],
        filtered().map(row=>[row.department,months[row.m]+"/2026",row.head,row.hires,row.exits,row.engagement]));
    }
  });
  render();
}

/* 03 — Central de chamados */
const ticketStatuses=["Aberto","Em andamento","Resolvido"];
function ticketSeed(){
  return [
    {id:"t1",code:1048,subject:"Acesso ao ERP comercial",category:"Acessos",priority:"Alta",status:"Em andamento",owner:"Marina",date:dateISO(-1),history:["Solicitação recebida.","Permissões em análise."]},
    {id:"t2",code:1047,subject:"Rede instável na sala de reuniões",category:"Infraestrutura",priority:"Alta",status:"Aberto",owner:"Sem responsável",date:dateISO(-2),history:["Solicitação recebida."]},
    {id:"t3",code:1046,subject:"Instalação de ferramenta de BI",category:"Software",priority:"Média",status:"Em andamento",owner:"Lucas",date:dateISO(-3),history:["Licença em verificação."]},
    {id:"t4",code:1045,subject:"Novo usuário no sistema",category:"Acessos",priority:"Baixa",status:"Resolvido",owner:"Marina",date:dateISO(-4),history:["Usuário provisionado e acesso validado."]},
    {id:"t5",code:1044,subject:"Impressora sem conexão",category:"Infraestrutura",priority:"Média",status:"Aberto",owner:"Sem responsável",date:dateISO(),history:["Solicitação recebida."]}
  ];
}
function mountTickets(root){
  const ui=prepare(root,"helpgrid","SERVICE DESK / CENTRAL DE OPERAÇÕES");
  let state=readState("tickets",ticketSeed(),value=>Array.isArray(value)&&value.every(row=>
    row&&typeof row.subject==="string"&&Number.isFinite(row.code)&&ticketStatuses.includes(row.status)&&Array.isArray(row.history)));
  let query="",status="all",priority="all";

  function render(){
    const active=state.filter(row=>row.status!=="Resolvido");
    const rows=state.filter(row=>
      match(row.subject+" "+row.code+" "+row.owner,query)&&
      (status==="all"||row.status===status)&&
      (priority==="all"||row.priority===priority));
    ui.draw(`
      <div class="app-heading">
        <div><div class="app-eyebrow">SISTEMA OPERACIONAL / FILA DE TI</div><h2>Central de atendimento</h2><p>Priorize. Investigue. Resolva.</p></div>
        ${button("+ Abrir chamado","new-ticket","","primary")}
      </div>
      <div class="kpis">
        ${kpi("ABERTOS",num(state.filter(row=>row.status==="Aberto").length),"Aguardando início")}
        ${kpi("EM ANDAMENTO",num(state.filter(row=>row.status==="Em andamento").length),"Atendimento em curso",true)}
        ${kpi("ALTA PRIORIDADE",num(active.filter(row=>row.priority==="Alta").length),"Entre os chamados ativos")}
        ${kpi("RESOLVIDOS",num(state.filter(row=>row.status==="Resolvido").length),"Atendimentos concluídos")}
      </div>
      <div class="toolbar">
        <div class="field search-field"><label for="ticket-search">BUSCAR NA FILA</label>${input("ticket-search",query,'type="search" placeholder="ID, assunto ou responsável"')}</div>
        <div class="field filter-field"><label for="ticket-status">STATUS</label>${select("ticket-status",option("all","Todos",status)+ticketStatuses.map(value=>option(value,value,status)).join(""))}</div>
        <div class="field filter-field"><label for="ticket-priority">PRIORIDADE</label>${select("ticket-priority",option("all","Todas",priority)+["Alta","Média","Baixa"].map(value=>option(value,value,priority)).join(""))}</div>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Fila de chamados, role horizontalmente se necessário">
        <table class="data-table"><thead><tr>
          <th scope="col">ID / SOLICITAÇÃO</th><th scope="col">PRIORIDADE</th><th scope="col">RESPONSÁVEL</th><th scope="col">STATUS</th><th scope="col">AÇÃO</th>
        </tr></thead><tbody>${rows.map(row=>`<tr>
          <td><strong>#${row.code} · ${esc(row.subject)}</strong><small>${esc(row.category)} / ${dateLabel(row.date)}</small></td>
          <td><span class="badge ${row.priority==="Alta"?"high":row.priority==="Baixa"?"low":""}">${esc(row.priority)}</span></td>
          <td>${esc(row.owner)}</td>
          <td><span class="badge ${row.status==="Resolvido"?"done":""}">${row.status}</span></td>
          <td>${button("Abrir ↗","view-ticket",`data-id="${esc(row.id)}" aria-label="Abrir chamado ${row.code}"`,"small")}</td>
        </tr>`).join("")||'<tr><td colspan="5" class="empty">Nenhum chamado encontrado para estes filtros.</td></tr>'}</tbody></table>
      </div>
      <p class="table-caption">${rows.length} de ${state.length} chamados. Indicadores consideram a fila completa.</p>${bottom()}`);
  }
  function newTicket(){
    ui.modal("Abrir chamado",`
      <form novalidate data-form="new-ticket">
        ${field("subject","Assunto *",input("subject","",'required maxlength="100" placeholder="Descreva o que precisa de atenção"'))}
        <div class="form-grid">
          ${field("category","Categoria",select("category",["Acessos","Infraestrutura","Software","Outros"].map(value=>option(value,value,"Acessos")).join("")))}
          ${field("priority","Prioridade",select("priority",["Baixa","Média","Alta"].map(value=>option(value,value,"Média")).join("")))}
        </div>
        ${field("description","Descrição *",'<textarea id="description" name="description" required maxlength="1000" placeholder="Contexto e impacto da solicitação"></textarea>')}
        ${formEnd("Criar chamado")}
      </form>`);
  }
  function viewTicket(id){
    const row=state.find(item=>item.id===id);
    if(!row)return;
    ui.modal("Chamado #"+row.code,`
      <form novalidate data-form="ticket-detail" data-id="${esc(row.id)}">
        <p><strong>${esc(row.subject)}</strong></p>
        <p class="dialog-note">${esc(row.category)} · ${dateLabel(row.date)} · ${esc(row.priority)} prioridade</p>
        <div class="form-grid">
          ${field("status","Status",select("status",ticketStatuses.map(value=>option(value,value,row.status)).join("")))}
          ${field("owner","Responsável",select("owner",["Sem responsável","Marina","Lucas","Emanueli"].map(value=>option(value,value,row.owner)).join("")))}
        </div>
        <h4>Histórico</h4>
        <ol class="history">${row.history.map(value=>`<li>${esc(value)}</li>`).join("")}</ol>
        ${field("new-note","Adicionar nota",'<textarea id="new-note" name="new-note" maxlength="1000" placeholder="Registre a próxima ação ou resolução"></textarea>')}
        ${formEnd("Salvar atendimento")}
      </form>`);
  }
  root.addEventListener("input",event=>{
    if(event.target.id==="ticket-search"){query=event.target.value;render();}
  });
  root.addEventListener("change",event=>{
    if(event.target.id==="ticket-status")status=event.target.value;
    else if(event.target.id==="ticket-priority")priority=event.target.value;
    else return;
    render();
  });
  root.addEventListener("click",event=>{
    const target=event.target.closest("[data-action]");
    if(!target)return;
    const action=target.dataset.action;
    if(action==="new-ticket")newTicket();
    if(action==="view-ticket")viewTicket(target.dataset.id);
    if(action==="reset")resetDialog(ui);
    if(action==="confirm-reset"){
      state=ticketSeed();query="";status="all";priority="all";ui.close();
      persist("tickets",state,"Fila restaurada.");render();
    }
  });
  root.addEventListener("submit",event=>{
    const type=event.target.dataset.form;
    if(!["new-ticket","ticket-detail"].includes(type))return;
    event.preventDefault();
    const data=formValues(event.target);
    if(type==="new-ticket"){
      if(!data.subject?.trim()||!data.description?.trim()){
        ui.error("Informe o assunto e a descrição do chamado.");return;
      }
      state.unshift({
        id:uid(),code:Math.max(1048,...state.map(row=>row.code))+1,
        subject:data.subject.trim().slice(0,100),
        category:data.category,priority:data.priority,status:"Aberto",
        owner:"Sem responsável",date:dateISO(),
        history:[data.description.trim().slice(0,1000)]
      });
    }else{
      const row=state.find(item=>item.id===event.target.dataset.id);
      if(!row||!ticketStatuses.includes(data.status))return;
      if(row.status!==data.status)row.history.push("Status alterado: "+row.status+" → "+data.status+".");
      if(row.owner!==data.owner)row.history.push("Responsável: "+data.owner+".");
      row.status=data.status;row.owner=data.owner;
      if(data["new-note"]?.trim())row.history.push(data["new-note"].trim().slice(0,1000));
    }
    ui.close();
    persist("tickets",state,type==="new-ticket"?"Chamado criado.":"Atendimento atualizado.");
    render();
  });
  render();
}

/* 04 — E-commerce */
const products=[
  {id:"p1",name:"Vaso Arco",category:"Cerâmica",price:149,kind:"vase",color:"#ab694b",description:"Cerâmica de superfície fosca, com curvas suaves e formas orgânicas.",size:"24 × 14 cm"},
  {id:"p2",name:"Luminária Duna",category:"Iluminação",price:329,kind:"lamp",color:"#c29c58",description:"Luz difusa e uma silhueta leve para a mesa de trabalho ou o canto de leitura.",size:"32 × 22 cm"},
  {id:"p3",name:"Bandeja Plano",category:"Objetos",price:89,kind:"tray",color:"#7d8d75",description:"Uma base versátil para organizar pequenos objetos e compor superfícies.",size:"28 × 18 cm"},
  {id:"p4",name:"Vaso Linha",category:"Cerâmica",price:119,kind:"bottle",color:"#d1b88f",description:"Linhas limpas e acabamento acetinado em uma peça para flores ou uso decorativo.",size:"28 × 10 cm"},
  {id:"p5",name:"Luminária Orbital",category:"Iluminação",price:279,kind:"orb",color:"#ae7863",description:"Um globo opalino apoiado sobre base sólida. Luz acolhedora em escala compacta.",size:"25 × 18 cm"},
  {id:"p6",name:"Bowl Pedra",category:"Objetos",price:99,kind:"bowl",color:"#94988a",description:"Um recipiente amplo, de textura suave e borda delicada, para a organização da casa.",size:"22 × 7 cm"}
];
let artIndex=0;
function productArt(product){
  const gradientId="product-gradient-"+(++artIndex);
  let shape="";
  if(product.kind==="vase")shape='<path d="M83 54Q104 43 124 54L120 85Q156 106 150 155Q146 186 104 187Q61 186 58 155Q52 112 87 85Z"/><ellipse cx="104" cy="54" rx="21" ry="7" fill="#0003"/><path d="M82 103Q68 143 79 169" fill="none" stroke="#fff3" stroke-width="4"/>';
  if(product.kind==="lamp")shape='<path d="M100 82H112V172H100Z"/><path d="M69 174Q106 157 144 174L146 182H67Z"/><path d="M53 88Q57 25 106 24Q154 25 161 88Z"/><ellipse cx="107" cy="89" rx="54" ry="8" fill="#e9cd91"/><path d="M74 75Q78 43 98 36" fill="none" stroke="#fff3" stroke-width="4"/>';
  if(product.kind==="tray")shape='<path d="M33 107Q105 82 180 110L170 146Q97 171 39 140Z"/><ellipse cx="107" cy="111" rx="73" ry="29"/><ellipse cx="107" cy="111" rx="63" ry="21" fill="#0001"/>';
  if(product.kind==="bottle")shape='<path d="M93 35H119L118 77Q138 91 138 119V178Q106 188 75 178V119Q75 91 94 77Z"/><ellipse cx="106" cy="35" rx="13" ry="4" fill="#0004"/><path d="M89 101V169" fill="none" stroke="#fff3" stroke-width="4"/>';
  if(product.kind==="orb")shape='<path d="M87 139H125L136 180Q106 188 77 180Z"/><circle cx="106" cy="94" r="52" fill="#f1e7d3"/><path d="M74 80Q83 53 111 54" fill="none" stroke="#fff7" stroke-width="6"/>';
  if(product.kind==="bowl")shape='<path d="M41 112Q48 169 105 173Q164 169 174 112Z"/><ellipse cx="107" cy="112" rx="67" ry="21"/><ellipse cx="107" cy="111" rx="58" ry="15" fill="#0002"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 212" role="img" aria-label="Ilustração de ${esc(product.name)}">
    <defs><linearGradient id="${gradientId}" x1="0" x2="1"><stop stop-color="${product.color}"/><stop offset=".38" stop-color="${product.color}"/><stop offset="1" stop-color="#000" stop-opacity=".33"/></linearGradient></defs>
    <ellipse cx="108" cy="190" rx="58" ry="7" fill="#5c3c2322"/>
    <g fill="url(#${gradientId})">${shape}</g></svg>`;
}
function cartTotals(cart){
  const lines=products.filter(product=>cart[product.id]>0)
    .map(product=>({...product,quantity:Math.min(20,Math.max(1,Number(cart[product.id])||1))}));
  const count=sum(lines,"quantity");
  const subtotal=sum(lines,product=>product.price*product.quantity);
  const shipping=count&&subtotal<300?24.9:0;
  return {lines,count,subtotal,shipping,total:subtotal+shipping};
}
function mountShop(root){
  const ui=prepare(root,"forma.","OBJETOS & LIVING / COLEÇÃO 01",
    button('Sacola <span id="cart-count">(0)</span>',"cart",'id="open-cart"'));
  let cart=readState("shop",{},value=>typeof value==="object"&&!Array.isArray(value)&&Object.entries(value).every(([id,count])=>products.some(product=>product.id===id)&&Number.isInteger(count)&&count>=1&&count<=20));
  let query="",category="all",sort="curated";

  function render(){
    let list=products.filter(product=>match(product.name+" "+product.description,query)&&(category==="all"||product.category===category));
    if(sort==="price-up")list.sort((a,b)=>a.price-b.price);
    if(sort==="price-down")list.sort((a,b)=>b.price-a.price);
    $("#cart-count",root).textContent="("+cartTotals(cart).count+")";
    ui.draw(`
      <div class="app-heading">
        <div><div class="app-eyebrow">CURADORIA Nº 01 / OBJETOS ESSENCIAIS</div><h2>O espaço de cada coisa.</h2></div>
        <p class="shop-intro">Peças que encontram lugar no cotidiano.<br>Uma coleção de formas, texturas e funções.</p>
      </div>
      <div class="toolbar">
        <div class="field search-field"><label for="shop-search">Encontre uma peça</label>${input("shop-search",query,'type="search" placeholder="Buscar na coleção"')}</div>
        <div class="field filter-field"><label for="shop-category">Categoria</label>${select("shop-category",option("all","Toda a coleção",category)+["Cerâmica","Iluminação","Objetos"].map(value=>option(value,value,category)).join(""))}</div>
        <div class="field filter-field"><label for="shop-sort">Ordenar</label>${select("shop-sort",option("curated","Curadoria",sort)+option("price-up","Menor preço",sort)+option("price-down","Maior preço",sort))}</div>
      </div>
      <div class="shop-grid">${list.map(product=>`
        <article class="product-card">
          <div class="product-art"><span class="product-category">${product.category}</span>${productArt(product)}</div>
          <div class="product-info"><h3>${product.name}</h3>
            <div class="product-meta"><small>${product.size}</small><span>${money(product.price)}</span></div>
            <div class="product-buttons">
              ${button("Detalhes","product",`data-id="${product.id}" aria-label="Detalhes de ${product.name}"`)}
              ${button("+ Sacola","add-cart",`data-id="${product.id}" aria-label="Adicionar ${product.name} à sacola"`,"primary")}
            </div>
          </div>
        </article>`).join("")||empty("Não encontramos peças com esses filtros.")}</div>
      <div class="app-bottom"><span>LOJA DEMONSTRATIVA · Frete fictício de R$ 24,90. Grátis a partir de R$ 300.</span><button type="button" data-action="reset">Esvaziar sacola</button></div>`);
  }
  function showCart(){
    const summary=cartTotals(cart);
    ui.modal("Sua sacola",summary.count?`
      ${summary.lines.map(product=>`<div class="cart-line">
        <div class="cart-art">${productArt(product)}</div>
        <div><h4>${product.name}</h4><p>${money(product.price)}</p>
          <div class="quantity">
            <button type="button" data-action="cart-minus" data-id="${product.id}" aria-label="Diminuir quantidade de ${product.name}">−</button>
            <span aria-label="Quantidade">${product.quantity}</span>
            <button type="button" data-action="cart-plus" data-id="${product.id}" aria-label="Aumentar quantidade de ${product.name}" ${product.quantity>=20?"disabled":""}>+</button>
          </div>
        </div>
        <button type="button" class="cart-remove" data-action="cart-remove" data-id="${product.id}" aria-label="Remover ${product.name} da sacola">×</button>
      </div>`).join("")}
      <div class="cart-totals">
        <div><span>Subtotal</span><span>${money(summary.subtotal)}</span></div>
        <div><span>Frete demonstrativo</span><span>${summary.shipping?money(summary.shipping):"Grátis"}</span></div>
        <div class="grand-total"><strong>Total</strong><strong>${money(summary.total)}</strong></div>
      </div>
      <p class="dialog-note">Simulação de compra. Nenhuma cobrança será realizada.</p>
      <div class="form-actions">${button("Continuar explorando","close")}${button("Simular pedido →","checkout","","primary")}</div>
    `:empty("Sua sacola ainda está vazia.")+`<div class="form-actions">${button("Explorar coleção","close","","primary")}</div>`);
  }
  function checkout(){
    if(!cartTotals(cart).count)return;
    ui.modal("Finalizar simulação",`
      <form novalidate data-form="checkout">
        <p class="dialog-note">Use dados fictícios. Este formulário demonstra a validação do pedido; as informações não são enviadas nem salvas.</p>
        ${field("name","Nome de teste *",input("name","",'required maxlength="80" autocomplete="off" placeholder="Ex.: Pessoa de Teste"'))}
        ${field("email","E-mail de teste *",input("email","",'type="email" required maxlength="120" autocomplete="off" placeholder="teste@example.com"'))}
        ${field("cep","CEP de teste *",input("cep","",'required inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" maxlength="9" placeholder="00000-000" autocomplete="off"'))}
        <p class="dialog-note">Total demonstrativo: <strong>${money(cartTotals(cart).total)}</strong><br>Pagamento real: nenhum.</p>
        ${formEnd("Concluir pedido fictício")}
      </form>`);
  }
  function updateCart(message,keepOpen=false){
    persist("shop",cart,message);render();
    if(keepOpen)showCart();
  }
  root.addEventListener("input",event=>{
    if(event.target.id==="shop-search"){query=event.target.value;render();}
  });
  root.addEventListener("change",event=>{
    if(event.target.id==="shop-category")category=event.target.value;
    else if(event.target.id==="shop-sort")sort=event.target.value;
    else return;
    render();
  });
  root.addEventListener("click",event=>{
    const target=event.target.closest("[data-action]");
    if(!target)return;
    const action=target.dataset.action,id=target.dataset.id;
    const product=products.find(item=>item.id===id);
    if(action==="cart")showCart();
    if(action==="product"&&product){
      ui.modal(product.name,`
        <div class="product-art">${productArt(product)}</div>
        <p class="dialog-note">${product.description}</p>
        <p class="dialog-note">${product.category} · ${product.size}</p>
        <h4>${money(product.price)}</h4>
        <div class="form-actions">${button("Voltar","close")}${button("Adicionar à sacola","add-cart",`data-id="${product.id}"`,"primary")}</div>`);
    }
    if(action==="add-cart"&&product){
      if((cart[id]||0)>=20){notify("Limite de 20 unidades por peça nesta demonstração.");return;}
      cart[id]=(cart[id]||0)+1;ui.close();
      updateCart(product.name+" adicionado à sacola.");
    }
    if(action==="cart-plus"&&product){
      cart[id]=Math.min(20,(cart[id]||0)+1);
      updateCart("Quantidade atualizada.",true);
    }
    if(action==="cart-minus"&&product){
      cart[id]=(cart[id]||0)-1;
      if(cart[id]<=0)delete cart[id];
      updateCart("Quantidade atualizada.",true);
    }
    if(action==="cart-remove"&&product){
      delete cart[id];updateCart("Peça removida.",true);
    }
    if(action==="checkout")checkout();
    if(action==="reset")ui.modal("Esvaziar sacola",`
      <p class="dialog-note">Remover todas as peças da sacola demonstrativa?</p>
      <div class="form-actions">${button("Cancelar","close")}${button("Esvaziar","confirm-reset","","primary")}</div>`);
    if(action==="confirm-reset"){
      cart={};ui.close();updateCart("Sacola esvaziada.");
    }
  });
  root.addEventListener("submit",event=>{
    if(event.target.dataset.form!=="checkout")return;
    event.preventDefault();
    const data=formValues(event.target);
    if(!data.name?.trim()){ui.error("Informe seu nome de teste.");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||"")){
      ui.error("Informe um e-mail de teste válido.");return;
    }
    if(!/^\d{8}$/.test(String(data.cep||"").replace(/\D/g,""))){
      ui.error("Informe um CEP com 8 dígitos.");return;
    }
    const summary=cartTotals(cart);
    if(!summary.count){ui.error("Adicione uma peça à sacola antes de concluir.");return;}
    cart={};saveState("shop",cart);render();
    ui.modal("Simulação concluída",`
      <div class="order-confirmation">
        <div class="app-caption">PEDIDO DEMONSTRATIVO #F${String(Date.now()).slice(-6)}</div>
        <h4>Seu pedido ganhou forma.</h4>
        <p>${summary.count} ${summary.count===1?"peça selecionada":"peças selecionadas"} · ${money(summary.total)}<br>Nenhum pagamento ou pedido real foi feito.<br>Os dados de teste foram descartados.</p>
        ${button("Voltar à coleção","close","","primary")}
      </div>`);
    notify("Pedido fictício concluído.");
  });
  render();
}

/* 05 — Gestão jurídica ERP/CRM */
function legalSeed(){
  return {
    clients:[
      {id:"l1",name:"Aurora Comércio",email:"contato@aurora.example",type:"Pessoa jurídica"},
      {id:"l2",name:"Horizonte Serviços",email:"juridico@horizonte.example",type:"Pessoa jurídica"},
      {id:"l3",name:"Ana Almeida",email:"ana@example.com",type:"Pessoa física"}
    ],
    cases:[
      {id:"j1",title:"Revisão contratual",number:"DEMO-2026-001",client:"l1",area:"Contratual",status:"Em andamento",note:"Analisar cláusulas e organizar documentos.",fee:4800,paid:false,due:dateISO(3)},
      {id:"j2",title:"Acompanhamento tributário",number:"DEMO-2026-002",client:"l2",area:"Tributário",status:"Em análise",note:"Conferir documentos apresentados pelo cliente.",fee:6500,paid:false,due:dateISO(8)},
      {id:"j3",title:"Consultoria cível",number:"DEMO-2026-003",client:"l3",area:"Cível",status:"Concluído",note:"Relatório de encerramento entregue.",fee:1800,paid:true,due:dateISO(-3)}
    ],
    tasks:[
      {id:"a1",case:"j1",title:"Enviar revisão de contrato",due:dateISO(2),done:false},
      {id:"a2",case:"j2",title:"Conferir documentos recebidos",due:dateISO(-1),done:false},
      {id:"a3",case:"j2",title:"Reunião de acompanhamento",due:dateISO(5),done:false},
      {id:"a4",case:"j3",title:"Entregar relatório final",due:dateISO(-3),done:true}
    ]
  };
}
function mountLegal(root){
  const ui=prepare(root,"LEXORA","GESTÃO JURÍDICA / ESCRITÓRIO DEMONSTRATIVO");
  let state=readState("legal",legalSeed(),value=>
    value&&Array.isArray(value.clients)&&Array.isArray(value.cases)&&Array.isArray(value.tasks));
  let tab="cases",query="";
  const clientName=id=>state.clients.find(client=>client.id===id)?.name||"Cliente não identificado";

  function casePanel(){
    const rows=state.cases.filter(item=>match(item.title+" "+clientName(item.client)+" "+item.number,query));
    return `
      <div class="toolbar"><div class="field search-field"><label for="legal-search">Buscar processo ou cliente</label>${input("legal-search",query,'type="search" placeholder="Cliente, referência ou assunto"')}</div><span class="toolbar-note">${rows.length} processos encontrados</span></div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Processos, role horizontalmente se necessário">
        <table class="data-table"><thead><tr><th scope="col">Processo / Referência</th><th scope="col">Cliente</th><th scope="col">Área</th><th scope="col">Status</th><th scope="col">Detalhes</th></tr></thead>
        <tbody>${rows.map(item=>`<tr>
          <td><strong>${esc(item.title)}</strong><small>${esc(item.number)}</small></td>
          <td>${esc(clientName(item.client))}</td><td>${esc(item.area)}</td>
          <td><span class="badge ${item.status==="Concluído"?"done":""}">${esc(item.status)}</span></td>
          <td>${button("Abrir ↗","view-case",`data-id="${esc(item.id)}" aria-label="Abrir ${esc(item.title)}"`,"small")}</td>
        </tr>`).join("")||'<tr><td colspan="5" class="empty">Nenhum processo encontrado.</td></tr>'}</tbody></table>
      </div>`;
  }
  function clientPanel(){
    return `<div class="legal-clients">${state.clients.map(client=>`
      <article class="client-card">
        <span class="client-icon" aria-hidden="true">${esc(client.name.charAt(0))}</span>
        <h3>${esc(client.name)}</h3><p>${esc(client.type)}<br>${esc(client.email)}</p>
        <p>${state.cases.filter(item=>item.client===client.id).length} processos vinculados</p>
        ${button("Ver relacionamento","view-client",`data-id="${esc(client.id)}"`,"small")}
      </article>`).join("")||empty("Nenhum cliente cadastrado.")}</div>`;
  }
  function taskPanel(){
    const rows=[...state.tasks].sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due));
    return `<p class="panel-caption">Marque o prazo para registrar sua conclusão. Datas demonstrativas, sem vínculo com tribunais.</p>
      <ul class="task-list">${rows.map(task=>{
        const item=state.cases.find(item=>item.id===task.case);
        const late=task.due<dateISO()&&!task.done;
        return `<li class="task-item ${task.done?"is-done":""}">
          <input type="checkbox" id="task-${esc(task.id)}" data-task="${esc(task.id)}" ${task.done?"checked":""} aria-label="${task.done?"Reabrir":"Concluir"} prazo: ${esc(task.title)}">
          <label class="task-label" for="task-${esc(task.id)}">${esc(task.title)}<small>${esc(item?.title||"Processo")} · ${esc(clientName(item?.client))}</small></label>
          <span class="task-date">${task.done?"Concluído":late?"Data ultrapassada":"Prazo"} · ${dateLabel(task.due)}</span>
        </li>`;
      }).join("")||empty("Nenhum prazo registrado.")}</ul>`;
  }
  function financePanel(){
    return `
      <div class="legal-summary">
        <div class="panel"><span class="panel-caption">HONORÁRIOS RECEBIDOS</span><strong>${money(sum(state.cases.filter(item=>item.paid),"fee"))}</strong></div>
        <div class="panel"><span class="panel-caption">HONORÁRIOS A RECEBER</span><strong>${money(sum(state.cases.filter(item=>!item.paid),"fee"))}</strong></div>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Honorários demonstrativos, role horizontalmente se necessário">
        <table class="data-table"><thead><tr><th scope="col">Cliente / Processo</th><th scope="col">Vencimento</th><th scope="col">Honorários</th><th scope="col">Situação</th><th scope="col">Registro</th></tr></thead>
        <tbody>${state.cases.map(item=>`<tr>
          <td><strong>${esc(clientName(item.client))}</strong><small>${esc(item.title)}</small></td>
          <td>${dateLabel(item.due)}</td><td>${money(item.fee)}</td>
          <td><span class="badge ${item.paid?"done":""}">${item.paid?"Recebido":"Pendente"}</span></td>
          <td>${button(item.paid?"Desfazer baixa":"Registrar recebimento","toggle-payment",`data-id="${esc(item.id)}" aria-label="${item.paid?"Desfazer baixa":"Registrar recebimento"}: ${esc(item.title)}"`,"small")}</td>
        </tr>`).join("")}</tbody></table>
      </div><p class="table-caption">Baixas locais demonstrativas. Nenhuma movimentação bancária é realizada.</p>`;
  }
  function render(){
    const active=state.cases.filter(item=>item.status!=="Concluído");
    const pending=state.tasks.filter(task=>!task.done);
    const late=pending.filter(task=>task.due<dateISO());
    ui.draw(`
      <div class="app-heading">
        <div><div class="app-eyebrow">PAINEL DO ESCRITÓRIO / ${dateLabel(dateISO())}</div><h2>O detalhe faz parte do todo.</h2><p>Relacionamentos e rotinas em uma única visão.</p></div>
        <div class="app-actions">${button("+ Cliente","new-client")}${button("+ Processo","new-case","","primary")}</div>
      </div>
      <div class="kpis">
        ${kpi("Processos em atividade",num(active.length),"Em análise ou andamento")}
        ${kpi("Clientes cadastrados",num(state.clients.length),"Relacionamento e histórico")}
        ${kpi("Prazos pendentes",num(pending.length),late.length+" com data ultrapassada")}
        ${kpi("Honorários a receber",compactMoney(sum(state.cases.filter(item=>!item.paid),"fee")),"Valores demonstrativos")}
      </div>
      <div class="legal-tabs" role="tablist" aria-label="Áreas do escritório">
        ${[["cases","Processos"],["clients","Clientes"],["tasks","Prazos"],["finance","Financeiro"]].map(([id,label])=>
          `<button type="button" class="legal-tab" role="tab" id="tab-${id}" aria-selected="${tab===id}" aria-controls="legal-panel" tabindex="${tab===id?0:-1}" data-action="legal-tab" data-tab="${id}">${label}</button>`).join("")}
      </div>
      <section id="legal-panel" role="tabpanel" aria-labelledby="tab-${tab}">
        ${tab==="cases"?casePanel():tab==="clients"?clientPanel():tab==="tasks"?taskPanel():financePanel()}
      </section>${bottom()}`);
  }
  function newClient(){
    ui.modal("Novo cliente",`
      <form novalidate data-form="new-client">
        ${field("client-name","Nome ou razão social *",input("client-name","",'required maxlength="100"'))}
        ${field("client-email","E-mail de teste *",input("client-email","",'type="email" required maxlength="120" placeholder="cliente@example.com"'))}
        ${field("client-type","Tipo de cliente",select("client-type",option("Pessoa jurídica","Pessoa jurídica","Pessoa jurídica")+option("Pessoa física","Pessoa física","Pessoa jurídica")))}
        <p class="dialog-note">Cadastre apenas informações fictícias nesta demonstração.</p>
        ${formEnd("Cadastrar cliente")}
      </form>`);
  }
  function newCase(){
    if(!state.clients.length){newClient();return;}
    ui.modal("Novo processo",`
      <form novalidate data-form="new-case"><div class="form-grid">
        ${field("case-title","Assunto *",input("case-title","",'required maxlength="100"'),true)}
        ${field("case-client","Cliente",select("case-client",state.clients.map(client=>option(client.id,client.name,state.clients[0].id)).join("")),true)}
        ${field("case-number","Referência demonstrativa *",input("case-number","DEMO-2026-"+String(state.cases.length+1).padStart(3,"0"),'required maxlength="50"'))}
        ${field("case-area","Área",select("case-area",["Cível","Contratual","Tributário","Trabalhista"].map(value=>option(value,value,"Cível")).join("")))}
        ${field("case-date","Primeiro prazo e vencimento *",input("case-date",dateISO(7),'type="date" required'))}
        ${field("case-fee","Honorários (R$) *",input("case-fee","",'type="number" min="0" max="10000000" step="0.01" required inputmode="decimal"'))}
        ${field("case-task","Descrição do primeiro prazo *",input("case-task","",'required maxlength="120" placeholder="Ex.: Conferir documentos"'),true)}
      </div>${formEnd("Cadastrar processo")}</form>`);
  }
  function viewCase(id){
    const item=state.cases.find(item=>item.id===id);
    if(!item)return;
    ui.modal("Detalhes do processo",`
      <form novalidate data-form="case-detail" data-id="${esc(item.id)}">
        <h4>${esc(item.title)}</h4>
        <p class="dialog-note">${esc(item.number)} · ${esc(item.area)}<br>Cliente: ${esc(clientName(item.client))}<br>Honorários: ${money(item.fee)} · ${item.paid?"Recebido":"A receber"}</p>
        ${field("case-status","Situação",select("case-status",["Em análise","Em andamento","Concluído"].map(value=>option(value,value,item.status)).join("")))}
        ${field("case-note","Anotações",`<textarea id="case-note" name="case-note" maxlength="1200">${esc(item.note)}</textarea>`)}
        <p class="dialog-note">Os prazos vinculados são controlados separadamente na aba Prazos.</p>
        ${formEnd("Salvar processo")}
      </form>`);
  }
  root.addEventListener("input",event=>{
    if(event.target.id==="legal-search"){query=event.target.value;render();}
  });
  root.addEventListener("change",event=>{
    const id=event.target.dataset.task;
    if(!id)return;
    const task=state.tasks.find(task=>task.id===id);
    if(task){
      task.done=event.target.checked;
      persist("legal",state,task.done?"Prazo concluído.":"Prazo reaberto.");
      render();
    }
  });
  root.addEventListener("keydown",event=>{
    if(event.target.getAttribute("role")!=="tab"||
      !["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();
    const tabs=["cases","clients","tasks","finance"];
    const index=tabs.indexOf(tab);
    tab=event.key==="Home"?"cases":event.key==="End"?"finance":
      tabs[(index+(event.key==="ArrowRight"?1:3))%4];
    render();$("#tab-"+tab,root)?.focus();
  });
  root.addEventListener("click",event=>{
    const target=event.target.closest("[data-action]");
    if(!target)return;
    const action=target.dataset.action,id=target.dataset.id;
    if(action==="legal-tab"){tab=target.dataset.tab;render();}
    if(action==="new-client")newClient();
    if(action==="new-case")newCase();
    if(action==="view-case")viewCase(id);
    if(action==="view-client"){
      const client=state.clients.find(client=>client.id===id);
      if(!client)return;
      const cases=state.cases.filter(item=>item.client===id);
      ui.modal("Relacionamento com o cliente",`
        <h4>${esc(client.name)}</h4><p class="dialog-note">${esc(client.type)} · ${esc(client.email)}</p>
        <h4>Processos vinculados</h4>
        ${cases.map(item=>`<p class="dialog-note"><strong>${esc(item.title)}</strong><br>${esc(item.number)} · ${esc(item.status)}</p>`).join("")||'<p class="dialog-note">Ainda não há processos vinculados.</p>'}
        <div class="form-actions">${button("Fechar","close")}</div>`);
    }
    if(action==="toggle-payment"){
      const item=state.cases.find(item=>item.id===id);
      if(!item)return;
      item.paid=!item.paid;
      persist("legal",state,item.paid?"Recebimento demonstrativo registrado.":"Baixa desfeita.");
      render();
    }
    if(action==="reset")resetDialog(ui);
    if(action==="confirm-reset"){
      state=legalSeed();tab="cases";query="";ui.close();
      persist("legal",state,"Escritório demonstrativo restaurado.");render();
    }
  });
  root.addEventListener("submit",event=>{
    const type=event.target.dataset.form;
    if(!["new-client","new-case","case-detail"].includes(type))return;
    event.preventDefault();
    const data=formValues(event.target);
    if(type==="new-client"){
      if(!data["client-name"]?.trim()||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data["client-email"]||"")){
        ui.error("Informe um nome e um e-mail de teste válido.");return;
      }
      state.clients.push({
        id:uid(),name:data["client-name"].trim().slice(0,100),
        email:data["client-email"].trim().slice(0,120),type:data["client-type"]
      });
      tab="clients";
    }
    if(type==="new-case"){
      const fee=Number(data["case-fee"]);
      if(!data["case-title"]?.trim()||!data["case-number"]?.trim()||
        !data["case-task"]?.trim()||
        !/^\d{4}-\d{2}-\d{2}$/.test(data["case-date"]||"")||
        data["case-fee"]===""||!Number.isFinite(fee)||fee<0||fee>1e7||
        !state.clients.some(client=>client.id===data["case-client"])){
        ui.error("Preencha todos os campos obrigatórios com valores válidos.");return;
      }
      const id=uid();
      state.cases.push({
        id,title:data["case-title"].trim().slice(0,100),
        number:data["case-number"].trim().slice(0,50),
        client:data["case-client"],area:data["case-area"],status:"Em análise",
        note:"",fee,paid:false,due:data["case-date"]
      });
      state.tasks.push({
        id:uid(),case:id,title:data["case-task"].trim().slice(0,120),
        due:data["case-date"],done:false
      });
      tab="cases";query="";
    }
    if(type==="case-detail"){
      const item=state.cases.find(item=>item.id===event.target.dataset.id);
      if(!item||!["Em análise","Em andamento","Concluído"].includes(data["case-status"]))return;
      item.status=data["case-status"];
      item.note=(data["case-note"]||"").slice(0,1200);
    }
    ui.close();
    persist("legal",state,type==="new-client"?"Cliente cadastrado.":type==="new-case"?"Processo, prazo e honorários cadastrados.":"Processo atualizado.");
    render();
  });
  render();
}

/* 06 — Dashboard tributário */
const taxTypes=["ICMS","ISS","PIS","COFINS","IRPJ","CSLL"];
const taxData=["Matriz","Filial"].flatMap((unit,index)=>months.map((month,m)=>{
  const revenue=180000+m*17000+index*45000;
  const values=[12400,2800,1400,6500,4200,2400].map((value,t)=>
    Math.round(value*(1+m*.075+index*.25)+(m%2?180:-90)*(t+1)));
  return {unit,month,m,revenue,values,tax:sum(values,value=>value)};
}));
function taxSummary(rows){
  const revenue=sum(rows,"revenue"),tax=sum(rows,"tax");
  return {
    revenue,tax,rate:revenue?tax/revenue*100:0,
    composition:taxTypes.map((name,index)=>({
      name,value:sum(rows,row=>row.values[index])
    }))
  };
}
function mountTax(root){
  const ui=prepare(root,"NUMÉRA","TAX INTELLIGENCE / BASE DEMONSTRATIVA");
  let period="all",unit="all";
  const filtered=()=>filterPeriod(taxData,period)
    .filter(row=>unit==="all"||row.unit===unit);

  function render(){
    const rows=filtered(),summary=taxSummary(rows);
    const indexes=[...new Set(rows.map(row=>row.m))];
    const monthly=indexes.map(m=>sum(rows.filter(row=>row.m===m),"tax"));
    const maximum=Math.ceil(Math.max(...monthly,1)/20000)*20000;
    const xs=indexes.map((m,index)=>50+index*(530/Math.max(1,indexes.length-1)));
    const ys=monthly.map(value=>170-value/maximum*140);
    const path=xs.map((x,index)=>(index?"L":"M")+x+","+ys[index]).join(" ");
    const colors=["#cadb8d","#95b87b","#6e965c","#4c7650","#789883","#b0bf91"];
    let position=0;
    const gradient=summary.composition.map((item,index)=>{
      const start=position;
      position+=summary.tax?item.value/summary.tax*100:0;
      return colors[index]+" "+start+"% "+position+"%";
    }).join(",");
    const previous=monthly.length>1?monthly[monthly.length-2]:monthly[0];
    const variation=previous?(monthly[monthly.length-1]-previous)/previous*100:0;

    ui.draw(`
      <div class="app-heading">
        <div><div class="app-eyebrow">PAINEL ANALÍTICO / JANEIRO — JUNHO 2026</div><h2>Uma leitura da operação fiscal.</h2><p>Receitas e tributos em uma base inteiramente fictícia.</p></div>
        ${button("↓ Exportar recorte","export-tax")}
      </div>
      <div class="toolbar">
        ${field("tax-period","PERÍODO",select("tax-period",option("all","1º semestre · 2026",period)+option("q1","1º trimestre · 2026",period)+option("q2","2º trimestre · 2026",period)))}
        ${field("tax-unit","UNIDADE",select("tax-unit",option("all","Todas as unidades",unit)+option("Matriz","Matriz",unit)+option("Filial","Filial",unit)))}
      </div>
      <div class="kpis">
        ${kpi("Receita da base",compactMoney(summary.revenue),"Soma do período selecionado")}
        ${kpi("Tributos simulados",compactMoney(summary.tax),"Soma das seis categorias")}
        ${kpi("Tributos / receita",pct(summary.rate),"Relação entre os valores da base")}
        ${kpi("Variação do último mês",(variation>=0?"+":"")+pct(variation),months[indexes[indexes.length-1]]+" versus "+months[indexes[indexes.length-2]],true)}
      </div>
      <div class="grid-2">
        <section class="panel">
          <h3 class="panel-title">Evolução mensal dos tributos</h3>
          <p class="panel-caption">Valores em reais · Base zero · ${unit==="all"?"Matriz + Filial":unit}</p>
          <svg class="tax-line-chart" viewBox="0 0 620 205" role="img" aria-label="${esc(indexes.map((m,index)=>months[m]+": "+money(monthly[index])).join("; "))}">
            ${[0,.5,1].map(value=>`<line x1="50" y1="${170-value*140}" x2="590" y2="${170-value*140}" stroke="#34442f"/><text x="40" y="${174-value*140}" text-anchor="end">${num(maximum*value/1000)}k</text>`).join("")}
            <path d="${path} L${xs[xs.length-1]},170 L${xs[0]},170 Z" fill="#c6d88c12"/>
            <path d="${path}" stroke="#c6d88c" stroke-width="2.5" fill="none"/>
            ${xs.map((x,index)=>`<circle cx="${x}" cy="${ys[index]}" r="4" fill="#c6d88c"><title>${months[indexes[index]]}: ${money(monthly[index])}</title></circle><text x="${x}" y="196" text-anchor="middle">${months[indexes[index]]}</text>`).join("")}
          </svg>
          <div class="legend"><span><i></i>Total de tributos por mês</span></div>
        </section>
        <section class="panel">
          <h3 class="panel-title">Composição por tributo</h3>
          <p class="panel-caption">Participação sobre o total do recorte</p>
          <div class="tax-composition">
            <div class="tax-ring" style="background:conic-gradient(${gradient})" role="img" aria-label="${esc(summary.composition.map(item=>item.name+": "+pct(item.value/summary.tax*100)).join("; "))}">
              <div class="tax-ring-hole">6<br>CATEGORIAS</div>
            </div>
            <div class="composition-legend">${summary.composition.map((item,index)=>
              `<div><i style="background:${colors[index]}"></i><span>${item.name}</span><span>${pct(item.value/summary.tax*100)}</span></div>`).join("")}</div>
          </div>
          <p class="tax-footnote">A composição representa somente a distribuição dos valores fictícios. Não indica alíquotas legais nem enquadramento tributário.</p>
        </section>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Base tributária detalhada, role horizontalmente se necessário">
        <table class="data-table"><thead><tr>
          <th scope="col">Mês / Unidade</th><th scope="col">Receita</th>
          ${taxTypes.map(type=>`<th scope="col">${type}</th>`).join("")}
          <th scope="col">Total</th>
        </tr></thead>
        <tbody>${rows.map(row=>`<tr>
          <td><strong>${row.month} / 2026</strong><small>${row.unit}</small></td>
          <td>${money(row.revenue)}</td>
          ${row.values.map(value=>`<td>${money(value)}</td>`).join("")}
          <td><strong>${money(row.tax)}</strong></td>
        </tr>`).join("")}</tbody></table>
      </div>
      <p class="table-caption">${rows.length} registros no recorte · Valores monetários em reais.</p>
      ${bottom("Base fictícia · Sem apuração fiscal ou integração externa.",false)}`);
  }
  root.addEventListener("change",event=>{
    if(event.target.id==="tax-period")period=event.target.value;
    else if(event.target.id==="tax-unit")unit=event.target.value;
    else return;
    render();notify("Recorte tributário atualizado.");
  });
  root.addEventListener("click",event=>{
    if(event.target.closest('[data-action="export-tax"]')){
      downloadCSV("numera-tributos.csv",
        ["Mês","Unidade","Receita",...taxTypes,"Total"],
        filtered().map(row=>[row.month+"/2026",row.unit,row.revenue,...row.values,row.tax]));
    }
  });
  render();
}

/* Navegação da versão consolidada */
const mounts={
  crm:mountCRM,
  people:mountPeople,
  tickets:mountTickets,
  shop:mountShop,
  legal:mountLegal,
  tax:mountTax
};
function route(){
  const path=location.hash.replace(/^#/,"")||"/";
  const main=$("#conteudo");
  if(path==="/sobre"){
    document.title="Sobre — Emanueli de Souza";
    main.innerHTML=about();
  }else if(path==="/contato"){
    document.title="Contato — Emanueli de Souza";
    main.innerHTML=`<div class="page about"><a class="back-link" href="#/">← Voltar ao índice</a>${contactHTML(true)}</div>`;
  }else if(path.startsWith("/projeto/")){
    const slug=path.slice("/projeto/".length);
    const project=projects.find(item=>item.slug===slug);
    if(project){
      document.title=project.name+" — Emanueli de Souza";
      main.innerHTML=projectPage(project);
      mounts[project.theme]($("#demo"));
    }else{
      document.title="Página não encontrada — Emanueli de Souza";
      main.innerHTML=`<div class="page about"><span class="eyebrow">404</span><h1>Este caminho<br>não existe.</h1><a class="text-link" href="#/">Voltar aos projetos ↗</a></div>`;
    }
  }else{
    document.title="Emanueli de Souza — Portfólio de TI";
    main.innerHTML=home();
  }
  window.scrollTo({top:0,behavior:"instant"});
}
document.addEventListener("click",event=>{
  const target=event.target.closest("[data-scroll]");
  if(target)document.getElementById(target.dataset.scroll)
    ?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
});
window.addEventListener("hashchange",route);
route();
