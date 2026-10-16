(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=window.INTELLIGENCE_DATA;if(!data||data.schemaVersion!==1){$('coverage').textContent='展示数据缺失，请重新生成。';return;}
const categories=['严重','低于安全强度（设计导致）','实现缺陷','规范缺口'];
const columnClasses={'严重':'col-broken','低于安全强度（设计导致）':'col-low','实现缺陷':'col-implementation','规范缺口':'col-specification'};
const cats={kem:'密钥封装',signatures:'数字签名',kex:'密钥交换'};
const layers={design:'设计',implementation:'实现',specification_consistency:'规范一致性'};
const impactStatuses={broken:'存在严重问题的算法',low:'无严重问题但低于安全强度的算法',stable:'暂未有明显安全衰减（无问题或仅实现、规范问题）'};
const cellNotes={
 'signatures/sqisign2d2':{'严重':'容易修复'},
 'signatures/lynxer':{'严重':'已发布修改版本'},
 'signatures/morning-atlas':{'严重':'可修复'},
 'kem/lore':{'低于安全强度（设计导致）':'已发布修改版本，待核验'},
 'signatures/bit':{'低于安全强度（设计导致）':'提出修改采样'},
 'kem/cheetahkem':{'低于安全强度（设计导致）':'需修改环结构'},
 'kem/hep-qc':{'低于安全强度（设计导致）':'核心结构失效'},
 'signatures/qingluan':{'低于安全强度（设计导致）':'128 档量子安全低于 80 位'},
 'signatures/flextree':{'低于安全强度（设计导致）':'全部 8 档安全强度下降，需调整参数'}
};
const statuses={blocked:'受阻',partial:'局部核验',verified:'已有核验',queued:'待执行',not_started:'未开始',unverified:'未核验'};
const etypes={author_response:'作者回应',revision:'修订',withdrawal:'撤回',repair_release:'修复发布',repair_claim:'修复声明',external_reproduction:'外部复现',historical_import:'历史导入',analysis:'来源分析',response:'回应',team_response:'团队回应',repair_proposal:'修复提案',analysis_with_response_and_repair_proposal:'分析、回应及修复提案',third_party_review:'第三方复核'};
const familyOrder=['lattice_based','code_based','hash_based','isogeny_based','multivariate_based','mpc_in_the_head_based','multi_family','other','unknown','kex_protocol'];
const routeOrder=['lattice_structured_r_mlwe','lattice_unstructured','lattice_ntru','lattice_lip','lattice_other','code_rank','code_hamming','code_other'];
const unique=xs=>[...new Set(xs.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
const rows=data.algorithms,state={category:'',family:'',routes:new Set(),impactStatus:'',platform:'',layer:'',grade:'',review:'',showSupportingColumns:false};
const overallSourceDate=rows.flatMap(r=>r.events).map(e=>e.date).filter(x=>/^\d{4}-\d{2}-\d{2}/.test(x)).sort().at(-1)||'来源未注明';
$('overallUpdate').textContent=overallSourceDate;
const extraFields=[['impactStatus','算法外部影响',Object.keys(impactStatuses)],['platform','来源平台',unique(rows.flatMap(r=>r.platforms))],['layer','问题层面',Object.keys(layers)],['grade','严重程度',['重要','有限','暂无影响']],['review','人工审核',['待审核','已审核']]];
extraFields.forEach(([key,title,options])=>{const el=document.createElement('select');el.id=key;el.setAttribute('aria-label',title);el.innerHTML='<option value="">'+title+'：全部</option>'+options.map(x=>'<option value="'+esc(x)+'">'+esc(impactStatuses[x]||layers[x]||x)+'</option>').join('');el.onchange=()=>{state[key]=el.value;render();};$('extraFilters').append(el);});

function link(path,title){return '<span class="unavailable-link" title="资料库文档未包含在本页">'+esc(title)+'（未包含）</span>';}
function source(url,label){try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return '';return '<a href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(label||u.hostname+' 原文')+'</a>';}catch{return '';}}
const pending=(r,e)=>e.issueIds.some(id=>r.issues.find(i=>i.id===id)?.pending);
const latest=r=>r.events.map(e=>e.date).filter(x=>/^\d{4}-\d{2}-\d{2}/.test(x)).sort().at(-1)||'';
const countlink=(key,kind,value,title)=>value?'<a class="countlink" href="#" data-key="'+esc(key)+'" data-kind="'+esc(kind)+'" aria-label="'+esc(title)+'">'+value+'</a>':'<span class="zero">0</span>';
const responseEvents=r=>r.events.filter(e=>e.responseActions.length);
const countText=(label,count)=>esc(label)+'（'+count+'）';
const issueRepairLinks=(key,issues)=>unique(issues.flatMap(i=>i.repairs)).map(x=>'<a href="#" data-key="'+esc(key)+'" data-kind="issue-repair:'+esc(x)+'">'+countText(x,issues.filter(i=>i.repairs.includes(x)).length)+'</a>').join('')||'尚无问题级修复建议';
const responseActionOrder=['撤回或撤稿','发布修复','提出修复','修改参数','修改实现','修订规范或证明','回应'];
const responseActionLinks=(key,events,limit=Infinity)=>{
 const actions=unique(events.flatMap(e=>e.responseActions)).sort((a,b)=>{
  const ai=responseActionOrder.indexOf(a),bi=responseActionOrder.indexOf(b);
  return (ai<0?responseActionOrder.length:ai)-(bi<0?responseActionOrder.length:bi)||a.localeCompare(b,'zh-CN');
 });
 if(!actions.length)return '<span class="zero">—</span>';
 const visibleLimit=actions.length>limit?Math.max(1,limit-1):limit;
 const visible=actions.slice(0,visibleLimit).map(x=>'<a href="#" title="'+esc(countText(x,events.filter(e=>e.responseActions.includes(x)).length))+'" data-key="'+esc(key)+'" data-kind="response-action:'+esc(x)+'">'+countText(x,events.filter(e=>e.responseActions.includes(x)).length)+'</a>');
 if(actions.length>limit)visible.push('<a class="response-more" href="#" title="查看全部 '+events.length+' 条回应" data-key="'+esc(key)+'" data-kind="response-all">全部回应（'+events.length+'）</a>');
 return visible.join('');
};
const submitterDetails=r=>'<details class="submitter-details"><summary>提交团队与单位</summary><div><b>提交团队</b><span>'+esc(r.submitters.join('、')||'未登记')+'</span></div><div><b>所属单位</b><span>'+esc(r.organizations.join('、')||'未登记')+'</span></div></details>';
const hardnessCell=r=>'<td class="hardness-cell" title="'+esc(r.hardProblems.join('；'))+'"><strong>'+esc(r.primaryProblem)+'</strong><span>'+esc(r.hardProblems.join('；'))+'</span></td>';

function chip(kind,value,label,count,active){return '<button type="button" class="filter-chip '+(active?'active':'')+'" data-filter-kind="'+kind+'" data-filter-value="'+esc(value)+'">'+esc(label)+'<span>'+count+'</span></button>';}
function grouped(items,idKey,labelKey,order){const groups={};items.forEach(r=>{const id=r[idKey]||'unknown',label=r[labelKey]||'未分类';if(!groups[id])groups[id]={id,label,count:0};groups[id].count++;});return Object.values(groups).sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id),ap=ai<0?order.length:ai,bp=bi<0?order.length:bi;return ap-bp||b.count-a.count||a.label.localeCompare(b.label,'zh-CN');});}
function algorithmImpactStatus(r){if(r.issues.some(i=>i.displayCategory==='严重'))return 'broken';if(r.issues.some(i=>i.displayCategory==='低于安全强度（设计导致）'))return 'low';return 'stable';}
function renderPrimaryFilters(){
 $('categoryFilters').innerHTML=chip('category','','全部',rows.length,!state.category)+Object.keys(cats).map(id=>chip('category',id,cats[id],rows.filter(r=>r.category===id).length,state.category===id)).join('');
 const categoryRows=state.category?rows.filter(r=>r.category===state.category):rows,families=grouped(categoryRows,'familyId','family',familyOrder);
 if(state.family&&!families.some(x=>x.id===state.family)){state.family='';state.routes.clear();}
 $('familyFilters').innerHTML=chip('family','','全部技术家族',categoryRows.length,!state.family)+families.map(x=>chip('family',x.id,x.label,x.count,state.family===x.id)).join('');
 const familyRows=state.family?categoryRows.filter(r=>r.familyId===state.family):categoryRows,routes=grouped(familyRows,'routeId','route',routeOrder);
 const routeIds=new Set(routes.map(x=>x.id));state.routes=new Set([...state.routes].filter(id=>routeIds.has(id)));
 $('routeFilters').innerHTML=state.family?chip('route','','全部二级路线',familyRows.length,!state.routes.size)+routes.map(x=>chip('route',x.id,x.label,x.count,state.routes.has(x.id))).join(''):chip('route','','请先选择一级技术家族',familyRows.length,true);
}
function selected(){
 const eventFilters=state.platform||state.layer||state.grade||state.review;
 return rows.filter(r=>(!state.category||r.category===state.category)&&(!state.family||r.familyId===state.family)&&(!state.routes.size||state.routes.has(r.routeId))&&(!state.impactStatus||algorithmImpactStatus(r)===state.impactStatus)&&(!state.platform||r.platforms.includes(state.platform))&&(!$('q').value||(r.name+' '+r.key).toLowerCase().includes($('q').value.trim().toLowerCase()))).map(r=>{
  const events=r.events.filter(e=>(!state.platform||e.platform===state.platform)&&(!state.layer||e.layers.includes(state.layer))&&(!state.grade||e.grades.includes(state.grade))&&(!state.review||(e.classified&&(pending(r,e)?'待审核':'已审核')===state.review)));
  const visibleIssues=new Set(events.flatMap(e=>e.issueIds));
  const issues=(eventFilters?r.issues.filter(i=>visibleIssues.has(i.id)):r.issues).filter(i=>i.displayCategory);
  return {...r,events,issues};
 }).filter(r=>!eventFilters||r.events.length);
}
function renderImpactBars(rs){
 const items=[
  ['broken','严重'],
  ['low','低于安全强度（设计导致）'],
  ['implementation','实现缺陷'],
  ['specification','规范缺口']
 ].map(([klass,label])=>[klass,'issue-category:'+label,label,rs.filter(r=>r.issues.some(i=>i.displayCategory===label)).length]),max=Math.max(1,...items.map(x=>x[3]));
 $('impactBars').innerHTML=items.map(([klass,kind,label,count])=>'<a class="impact-card '+klass+'" href="#" data-key="*" data-kind="'+kind+'"><div class="impact-top"><b>'+label+'</b><strong>'+count+'</strong></div><div class="impact-track"><div class="impact-fill" style="width:'+Math.max(count?3:0,Math.round(count/max*100))+'%"></div></div></a>').join('');
 $('issueImpactBars').innerHTML=items.map(([klass,kind,label])=>{const count=rs.reduce((total,r)=>total+r.issues.filter(i=>i.displayCategory===label).length,0);return '<a class="issue-impact-card '+klass+'" href="#" data-key="*" data-kind="'+kind+'"><span>'+label+'</span><div><strong>'+count+'</strong><small>个问题</small></div></a>';}).join('');
}
function progress(r){if(!r.draft)return '<div class="progress"><strong class="pending">尚未形成分类草案</strong><span>'+r.events.length+' 条外部动态</span></div>';const waiting=r.issues.filter(i=>i.pending).length;return '<div class="progress"><strong class="'+(waiting?'pending':'done')+'">'+r.issues.length+' 个四类问题</strong><span>'+r.events.length+' 条动态'+(waiting?' · '+waiting+' 待审核':' · 审核记录已接入')+'</span></div>';}
function render(){
 renderPrimaryFilters();
 const rs=selected();rs.sort((a,b)=>$('sort').value==='name'?a.name.localeCompare(b.name):latest(b).localeCompare(latest(a)));
 const issues=rs.flatMap(r=>r.issues),events=rs.flatMap(r=>r.events);renderImpactBars(rs);
 const cells=(key,is,name)=>categories.map(x=>{const count=is.filter(i=>i.displayCategory===x).length,note=count?cellNotes[key]?.[x]:'';return '<td class="num '+columnClasses[x]+(count?' has-impact':'')+(note?' with-note':'')+'">'+countlink(key,'issue-category:'+x,count,name+' · '+x+'问题')+(note?'<span class="impact-cell-note">'+esc(note)+'</span>':'')+'</td>';}).join('');
 const supporting=state.showSupportingColumns;
 const headers=[['算法与功能',''],['技术分类',''],['基于的困难问题',''],...(supporting?[['外部分析进展','']]:[]),...categories.map(x=>[x,columnClasses[x]]),['作者团队回应','col-notice'],...(supporting?[['修复建议','']]:[]),['外部来源最新时间','source-date']];
 const responses=rs.flatMap(responseEvents);
 const responseCell=r=>'<td class="response-cell col-notice"><div class="response-actions">'+responseActionLinks(r.key,responseEvents(r),2)+'</div></td>';
 const algorithmCounts=Object.fromEntries(categories.map(category=>[category,rs.filter(r=>r.issues.some(i=>i.displayCategory===category)).length]));
 $('selectionSummary').textContent='（当前选择 '+rs.length+' 个算法、'+issues.length+' 个问题；其中 '+algorithmCounts['严重']+' 个算法存在严重问题、'+algorithmCounts['低于安全强度（设计导致）']+' 个算法低于安全强度、'+algorithmCounts['实现缺陷']+' 个算法存在实现缺陷、'+algorithmCounts['规范缺口']+' 个算法存在规范缺口；'+responses.length+' 条作者团队回应）';
 const colgroup='<colgroup><col class="algorithm-col"><col class="tech-col"><col class="hardness-col">'+(supporting?'<col class="progress-col">':'')+'<col class="impact-col"><col class="low-col"><col class="impact-col"><col class="impact-col"><col class="response-col">'+(supporting?'<col class="repair-col">':'')+'<col class="date-col"></colgroup>';
 $('sumTable').classList.toggle('show-supporting',supporting);
 $('columnToggle').textContent=supporting?'隐藏进展与修复建议':'显示进展与修复建议';$('columnToggle').setAttribute('aria-pressed',String(supporting));
 const impactStart=3+(supporting?1:0);
 $('sumTable').innerHTML=colgroup+'<thead><tr>'+headers.map(([text,klass],n)=>'<th class="'+klass+(n>=impactStart&&n<impactStart+4?' num':'')+'">'+text+'</th>').join('')+'</tr></thead><tbody>'+rs.map(r=>'<tr><td class="algorithm-cell"><a class="algorithm-name" title="查看 '+esc(r.name)+' 方案概览" href="#" data-key="'+esc(r.key)+'" data-kind="algorithm-profile">'+esc(r.name)+'</a><div class="algorithm-function">'+esc(cats[r.category])+' · 方案概览</div>'+submitterDetails(r)+'</td><td class="tech-cell"><strong title="'+esc(r.family||'未分类')+'">'+esc(r.family||'未分类')+'</strong><div class="muted" title="'+esc(r.route||'未分类')+'">'+esc(r.route||'未分类')+'</div></td>'+hardnessCell(r)+(supporting?'<td>'+progress(r)+'</td>':'')+cells(r.key,r.issues,r.name)+responseCell(r)+(supporting?'<td class="repair-cell">'+issueRepairLinks(r.key,r.issues)+(r.warnings.length?'<div class="warning">'+esc(r.warnings.join('；'))+'</div>':'')+'</td>':'')+'<td class="source-date">'+esc(latest(r)||'来源未注明')+'</td></tr>').join('')+'</tbody>';
 $('coverage').textContent='问题按规范化问题编号互斥计数；同一算法可以包含多类问题。当前筛选包含 '+events.length+' 条外部动态。';closeDrawer();
}
function drawerLinks(key){return key==='*'?'':'<span class="unavailable-link" title="算法详情未包含在本页">算法详情（未包含）</span> '+link('', '完整分类表')+' '+link('', '算法动态');}
const textList=items=>items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="muted">当前资料未给出独立说明。</p>';
const profileInline=value=>esc(value).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
function profileProse(value,empty='当前资料尚未形成该项总结。'){
 const blocks=[];let bullets=[];const flush=()=>{if(bullets.length){blocks.push('<ul>'+bullets.map(item=>'<li>'+profileInline(item)+'</li>').join('')+'</ul>');bullets=[];}};
 String(value||'').split(/\r?\n/).forEach(raw=>{const line=raw.trim();if(!line)return;if(line.startsWith('- ')){bullets.push(line.slice(2));return;}flush();blocks.push('<p>'+profileInline(line)+'</p>');});flush();return blocks.join('')||'<p class="muted">'+esc(empty)+'</p>';
}
const summaryList=(items,empty='当前资料尚未形成中文概括。')=>items?.length?'<ul class="profile-claim-list">'+items.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>':'<p class="muted">'+esc(empty)+'</p>';
function openProfile(key){
 const r=rows.find(row=>row.key===key);if(!r)return;
 const profile=r.profile||{},sections=profile.introductionSections||{},technical=profile.technical||{},flow=profile.principlesFlow||{};
 $('eventTitle').textContent=r.name+' · 方案基本原理';$('eventLinks').innerHTML=drawerLinks(key);
 const securityModels=(technical.securityModels||[]).join('、')||'未明确登记';
 $('eventContent').innerHTML='<article class="algorithm-profile"><div class="profile-hero"><h3>'+esc(r.name)+'</h3><p>'+esc(cats[r.category])+' · '+esc(r.family)+' · '+esc(r.route)+'</p></div><div class="profile-meta-strip"><span><b>核心困难问题：</b>'+esc(r.primaryProblem||'未明确登记')+'</span><span><b>安全模型：</b>'+esc(securityModels)+'</span>'+(profile.version?'<span><b>版本：</b>'+esc(profile.version)+'</span>':'')+'</div><section class="profile-section"><h3>设计框架与基本原理</h3>'+profileProse(sections.overview)+profileProse(sections.frameworkAndPrinciples)+'<p class="core-module-line"><b>核心模块：</b>'+esc(flow.moduleSummary||'当前资料尚未形成核心模块概括。')+'</p></section><section class="profile-section"><h3>关键创新</h3>'+profileProse(sections.innovations,'当前资料尚未形成独立创新性总结。')+'</section><div class="profile-two-column"><section class="profile-section"><h3>主要优势</h3>'+summaryList(profile.advantageSummary,'提案材料尚未登记明确优势。')+'</section><section class="profile-section"><h3>主要局限</h3>'+summaryList(profile.limitationSummary,'当前资料尚未登记明确限制。')+'</section></div><p class="profile-scope-note">设计与创新来自现有规格卡及算法介绍；优势与局限为结构化资料的中文概括，不替代独立安全评价。</p></article>';openDrawer();
}
function issueCard(r,i,issueDate,number){
 const related=r.events.filter(e=>i.eventIds.includes(e.id));
 const impact=i.displayCategory||'未纳入四类展示';
 const level=i.layers.map(x=>layers[x]||x).join('、')||'未标注';
 const layerTone=impact==='低于安全强度（设计导致）'?'design':impact==='实现缺陷'?'implementation':impact==='规范缺口'?'specification':i.layers.includes('design')?'design':i.layers.includes('implementation')?'implementation':i.layers.includes('specification_consistency')?'specification':'other';
 const layerLabel={design:'设计层面',implementation:'实现层面',specification:'规范一致性',other:'其他层面'}[layerTone];
 const summaryText=i.summary||i.title||'当前资料未给出问题摘要。';
 const normalizeText=value=>String(value||'').replace(/[\s，。；、,.，;：:（）()]/g,'').toLowerCase();
 const distinctImpact=i.sourceImpactDetails.filter(value=>normalizeText(value)!==normalizeText(summaryText));
 const confirmationClass=['confirmed','released'].includes(i.teamResponse.code)?'confirmed':['responded','proposed'].includes(i.teamResponse.code)?'responded':'unconfirmed';
 const teamAuthors=i.teamResponse.authors.length?'；署名：'+i.teamResponse.authors.join('、'):'';
 const repairDetails=i.teamResponse.repairSummaries.length?textList(i.teamResponse.repairSummaries):'<p class="muted">当前来源未登记具体修复措施。</p>';
 const keywordHint=i.teamResponse.keywordReviewHint?'<span class="review-hint">文字中可能含确认表述，待人工核对登记</span>':'';
 const verificationLinks=i.verificationLinks.length?'<div class="links">'+i.verificationLinks.map((p,n)=>link(p,'核验记录 '+(n+1))).join(' ')+'</div>':'';
 const reviewLinks=i.reviewLinks.length?'<div class="links">'+i.reviewLinks.map((p,n)=>link(p,'审核记录 '+(n+1))).join(' ')+'</div>':'';
 const localStatus=i.localStatuses.map(x=>statuses[x]||x).join('、')||'未登记',reviewStatus=i.pending?'待审核':'已审核';
 const machineLink=link('research/intelligence/'+r.key+'/events.json','机器记录 JSON');
 const sourceLinks=i.sources.map((url,n)=>source(url,i.sources.length>1?'问题来源 '+(n+1):'问题来源')).join('');
 const impactBody=distinctImpact.length?'<strong>'+esc(distinctImpact.join('；'))+'</strong>':i.scopes.length?'<strong>'+esc(i.scopes.join('；'))+'</strong>':'<span class="muted">来源未给出区别于摘要的独立影响说明。</span>';
 const scopeBody=distinctImpact.length&&i.scopes.length?'<div class="scope-line"><b>适用范围：</b>'+esc(i.scopes.join('；'))+'</div>':'';
 const responseBody='<span class="confirmation '+confirmationClass+'">'+esc(i.teamResponse.status)+'</span>'+esc(teamAuthors)+keywordHint+(i.teamResponse.summaries.length?'<div class="cell-list">'+textList(i.teamResponse.summaries)+'</div>':'');
 return '<article class="event-card issue-card"><div class="issue-record-head layer-'+layerTone+'"><div><span class="tag">'+esc(impact)+'</span><span class="layer-label">'+layerLabel+'</span><b>问题 '+number+'</b></div><time>'+esc(issueDate({r,i})||'来源时间缺失')+'</time></div><table class="issue-detail-table"><tbody>'+
  '<tr class="summary-row"><th>问题摘要</th><td><strong>'+esc(summaryText)+'</strong><span class="summary-links">'+sourceLinks+'</span></td></tr>'+
  '<tr><th>问题分类</th><td><strong>'+esc(impact)+'</strong><span class="inline-note">'+esc(i.grades.join('、')||'严重程度未登记')+'</span></td></tr>'+
  '<tr><th>影响</th><td>'+impactBody+scopeBody+'</td></tr>'+
  '<tr><th>修复</th><td><div class="repair-line"><b>来源措施：</b>'+repairDetails+'</div><div class="repair-line"><b>建议路径：</b><strong>'+esc(i.repairs.join('、')||'尚未分类')+'</strong><span class="inline-note">不作为作者或团队承诺</span></div></td></tr>'+
  '<tr><th>作者回应</th><td>'+responseBody+'</td></tr></tbody></table><div class="issue-aux">'+
  '<div class="compact-statuses"><details class="compact-detail"><summary><span>本地核验</span><strong>'+esc(localStatus)+'</strong></summary><div class="compact-detail-body"><p>本地核验状态与证据链接</p>'+verificationLinks+'</div></details><details class="compact-detail"><summary><span>人工审核</span><strong>'+reviewStatus+'</strong></summary><div class="compact-detail-body"><p>'+esc(i.review||'未登记审核说明')+'</p>'+reviewLinks+'</div></details></div>'+
  '<details class="machine-records"><summary>来源事件与机器记录（'+related.length+'）</summary><div class="machine-record-body"><p class="machine-id"><b>问题编号</b> '+esc(i.id)+' · '+i.claims+' 条来源主张 · '+related.length+' 个关联事件<br><b>问题层面</b> '+esc(level)+(i.externalTitles.length?'<br><b>来源标题</b> '+esc(i.externalTitles.join('；')):'')+'</p><div class="links">'+machineLink+'</div><div class="issue-events">'+related.map(e=>'<div class="issue-event"><time>'+esc(e.date)+' · '+esc(e.platform)+' · '+esc(etypes[e.eventType]||e.eventType||'外部动态')+(e.author?' · '+esc(e.author):'')+'</time><b>'+esc(e.title||e.id)+'</b><p>'+esc(e.summary||'尚未提供独立外部摘要。')+'</p><div class="links">'+source(e.url)+'</div></div>').join('')+'</div></div></details></div></article>';
}
function openIssues(key,kind){
 const rs=selected().filter(r=>key==='*'||r.key===key);let items=rs.flatMap(r=>r.issues.map(i=>({r,i})));
 if(kind.startsWith('issue-category:'))items=items.filter(({i})=>i.displayCategory===kind.slice(15));
 if(kind.startsWith('issue-repair:'))items=items.filter(({i})=>i.repairs.includes(kind.slice(13)));
 const issueDate=({r,i})=>r.events.filter(e=>i.eventIds.includes(e.id)).map(e=>/^\d{4}-\d{2}-\d{2}/.test(e.date)?e.date:'').sort().at(-1)||'';
 items.sort((a,b)=>issueDate(b).localeCompare(issueDate(a)));
 const rawTitle=kind==='issue-all'?'全部四类问题':kind.slice(kind.indexOf(':')+1),scope=key==='*'?'当前筛选':rs[0]?.name||key;
 $('eventTitle').textContent=scope+' · '+rawTitle+' · '+items.length+' 个问题';$('eventLinks').innerHTML=drawerLinks(key);
 $('eventContent').innerHTML=items.length?items.map(({r,i},n)=>issueCard(r,i,issueDate,n+1)).join(''):'<p class="empty">没有对应问题。</p>';openDrawer();
}
function openEvents(key,kind){
 const rs=selected().filter(r=>key==='*'||r.key===key);let items=rs.flatMap(r=>r.events.map(e=>({r,e}))).filter(({e})=>e.responseActions.length);
 if(kind.startsWith('response-action:'))items=items.filter(({e})=>e.responseActions.includes(kind.slice(16)));
 items.sort((a,b)=>(/^\d{4}-\d{2}-\d{2}/.test(b.e.date)?b.e.date:'').localeCompare(/^\d{4}-\d{2}-\d{2}/.test(a.e.date)?a.e.date:''));
 const scope=key==='*'?'当前筛选':rs[0]?.name||key,action=kind.startsWith('response-action:')?kind.slice(16):'全部回应';$('eventTitle').textContent=scope+' · '+action+'（'+items.length+'）';$('eventLinks').innerHTML=drawerLinks(key);
 const eventCard=({e})=>'<article class="event-card"><div class="event-card-head"><div>'+e.responseActions.map(x=>'<span class="tag">'+esc(x)+'</span>').join('')+'<b>'+esc(e.title||e.id)+'</b></div><time>'+esc(e.date)+'</time></div><p>'+esc(e.responseLead||e.summary||'尚未提供独立回应摘要，请打开原来源。')+'</p><div class="links">'+source(e.url)+'</div><div class="event-meta"><div><b>事件类型</b>'+esc(etypes[e.eventType]||e.eventType||'未标注')+'</div><div><b>关联问题</b>'+esc(e.issueIds.join('、')||'未关联问题')+'</div><div><b>关键动作</b>'+esc(e.responseActions.join('、'))+'</div><div><b>来源作者</b>'+esc(e.author||'未登记')+'</div></div></article>';
 $('eventContent').innerHTML=items.length?items.map(eventCard).join(''):'<p class="empty">没有对应作者团队回应。</p>';openDrawer();
}
let lastFocus=null;
function openDrawer(){lastFocus=document.activeElement;$('eventDrawer').classList.add('open');$('drawerBackdrop').classList.add('open');$('eventDrawer').setAttribute('aria-hidden','false');document.body.classList.add('drawer-open');$('drawerClose').focus();}
function closeDrawer(){if(!$('eventDrawer').classList.contains('open'))return;$('eventDrawer').classList.remove('open');$('drawerBackdrop').classList.remove('open');$('eventDrawer').setAttribute('aria-hidden','true');document.body.classList.remove('drawer-open');lastFocus?.focus();}
document.addEventListener('click',event=>{const filter=event.target.closest('[data-filter-kind]');if(filter){const kind=filter.dataset.filterKind,value=filter.dataset.filterValue;if(kind==='route'){if(!value)state.routes.clear();else if(state.routes.has(value))state.routes.delete(value);else state.routes.add(value);render();return;}state[kind]=value;if(kind==='category'){state.family='';state.routes.clear();}if(kind==='family')state.routes.clear();render();return;}const a=event.target.closest('a[data-key]');if(a){event.preventDefault();if(a.dataset.kind==='algorithm-profile')openProfile(a.dataset.key);else if(a.dataset.kind.startsWith('issue-'))openIssues(a.dataset.key,a.dataset.kind);else openEvents(a.dataset.key,a.dataset.kind);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeDrawer();});$('drawerClose').onclick=closeDrawer;$('drawerBackdrop').onclick=closeDrawer;$('q').oninput=render;$('sort').onchange=render;
$('reset').onclick=()=>{state.category='';state.family='';state.routes.clear();state.impactStatus='';state.platform='';state.layer='';state.grade='';state.review='';extraFields.forEach(([k])=>$(k).value='');$('q').value='';render();};render();
$('columnToggle').onclick=()=>{state.showSupportingColumns=!state.showSupportingColumns;render();};
})();
