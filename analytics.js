const FOOD_CATEGORIES = {
 'Мясо и птица':['chicken','thigh','mince'], 'Рыба':['fish'], 'Молочное и яйца':['egg','curd','milk','yogurt','cheese'],
 'Крупы, хлеб и бобовые':['oats','rice','buckwheat','pasta','flour','bread','lentils','beans'], 'Овощи':['potato','carrot','onion','cabbage','veg','tomato','fresh'],
 'Фрукты и ягоды':['fruit','berries'], 'Масло, орехи и специи':['oil','nuts','spice']
};
const categoryOf = id => Object.keys(FOOD_CATEGORIES).find(key=>FOOD_CATEGORIES[key].includes(id))||'Прочее';
const SEARCH_URLS = {pyaterochka:'https://5ka.ru/search/?text=',magnit:'https://magnit.ru/search?q=',lenta:'https://lenta.com/search/?searchText=',auchan:'https://www.auchan.ru/search/?q='};
const PRODUCT_LINKS = {tomato:{magnit:'https://magnit.ru/product/1000099820-pikanta_passata_protertaya_myakot_tomatov500g_t_p_italiya_6',lenta:'https://lenta.com/product/myakot-tomatov-passata-protertaya-rossiya-500g-558612/',pyaterochka:'https://5ka.ru/catalog/ogurtsy-tomaty--251C51931/'}};
function foodLink(id,store){return PRODUCT_LINKS[id]?.[store]|| (SEARCH_URLS[store]?SEARCH_URLS[store]+encodeURIComponent(FOODS[id].name):'https://chizhik.club/catalog/');}
function linkLabel(id,store){return PRODUCT_LINKS[id]?.[store]?(store==='pyaterochka'?'Категория ↗':'Товар ↗'):store==='chizhik'?'Каталог ↗':'Поиск ↗';}
function renderExtras(){renderCompare();renderAnalytics();}
let comparisonProduct='tomato';
function renderCompare(){
 const basket=rows();const products=basket.filter(r=>r.packs>0);
 const stores=Object.keys(STORES);
 const r=basket.find(r=>r.id===comparisonProduct)||basket[0];
 if(r){
 $('compare-title').textContent=r.emoji+' '+r.name;
 $('compare-unit').textContent=`Сравниваем цену за ${amount(r.pack,r.unit)} · в списке ${r.packs} уп.`;
 const knownPrices=stores.map(s=>state.prices[s]?.[r.id]).filter(v=>Number.isFinite(v));const minimum=knownPrices.length?Math.min(...knownPrices):null;
 $('compare-table').innerHTML=stores.map(s=>{const price=state.prices[s]?.[r.id],known=Number.isFinite(price);return `<div class="compare-choice ${known&&price===minimum?'best-price':''}"><div><strong>${STORES[s][0]}</strong><small>${known?'Введено вручную · '+(state.priceMeta?.[s]?.[r.id]||''):'Цена пока неизвестна'}</small></div><div><label class="sr-only" for="compare-${s}-${r.id}">Цена ${STORES[s][0]} за ${amount(r.pack,r.unit)}</label><input id="compare-${s}-${r.id}" type="number" min="0" max="100000" step="0.01" data-compare-store="${s}" data-compare-food="${r.id}" value="${known?price:''}" placeholder="Цена, ₽"></div><a target="_blank" rel="noopener" href="${foodLink(r.id,s)}">${linkLabel(r.id,s)}</a></div>`;}).join('');
 }
 $('store-totals').innerHTML=stores.map(s=>{const count=products.filter(r=>Number.isFinite(state.prices[s]?.[r.id])).length;const total=MealEngine.total(MealEngine.basket(state.plan,state.people,state.pantry,state.prices[s]||{}));return `<article class="store-total"><span>${STORES[s][0]}</span><strong>${money(total)}</strong><small>${count} из ${products.length} цен введено</small><button class="text" data-store-cart="${s}">Список покупок ↗</button></article>`;}).join('');
 $('shop-products').innerHTML=products.map(r=>`<div class="shop-product"><span>${r.emoji}</span><div><strong>${r.name}</strong><small>${r.packs} уп. по ${amount(r.pack,r.unit)} · ${money(r.cost)}</small></div><a href="${foodLink(r.id,state.store)}" target="_blank" rel="noopener">${linkLabel(r.id,state.store)}</a></div>`).join('');
 $('shop-stores').innerHTML=stores.map(s=>`<button class="${s===state.store?'primary':'secondary'}" data-store-cart="${s}">${STORES[s][0]}</button>`).join('');
}
function analyticsRange(){
 const period=$('analytics-period').value;
 const today=localDate(), now=new Date(today+'T12:00:00');let start,end;
 if(period==='month'){start=today.slice(0,7)+'-01';end=new Date(now.getFullYear(),now.getMonth()+1,0,12);end=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;}
 else {const elapsed=Math.max(0,Math.floor((Date.parse(today)-Date.parse(state.start))/86400000));start=new Date(Date.parse(state.start)+Math.floor(elapsed/14)*14*86400000).toISOString().slice(0,10);end=new Date(Date.parse(start)+13*86400000).toISOString().slice(0,10);}
 return {start,end};
}
function renderAnalytics(){
 const cost=MealEngine.total(rows()),purchases=state.purchases||[],range=analyticsRange();
 const selected=purchases.filter(p=>p.date>=range.start&&p.date<=range.end);
 const spent=selected.reduce((a,p)=>a+p.total,0);const days=Math.round((Date.parse(range.end)-Date.parse(range.start))/86400000)+1;
 const plan=$('analytics-period').value==='month'?cost/14*days:cost;
 $('plan-14').textContent=money(cost);$('plan-30').textContent=money(cost*30/14);$('actual-period').textContent=money(spent);
 $('analytics-range').textContent=`${range.start.split('-').reverse().join('.')} — ${range.end.split('-').reverse().join('.')} · ${selected.length} записей`;
 $('analytics-delta').textContent=selected.length?(spent>plan?'План превышен на '+money(spent-plan):'До плана осталось '+money(plan-spent)):'Добавьте покупки, чтобы увидеть фактические расходы.';
 $('analytics-help').textContent=`План периода — ${money(plan)} на продукты. Факт считается только по записанным покупкам. Снеки и фастфуд учитываются во вкладке «Бюджет».`;
 const sums=Object.fromEntries(Object.keys(FOOD_CATEGORIES).map(c=>[c,0]));sums['Прочее']=0;
 selected.forEach(p=>sums[p.category]=(sums[p.category]||0)+p.total);
 $('category-chart').innerHTML=Object.entries(sums).map(([name,total])=>`<div class="category-row"><div><span>${name}</span><strong>${money(total)}</strong></div><div class="bar-track"><span style="width:${spent?Math.min(100,total/spent*100):0}%"></span></div><small>${spent?Math.round(total/spent*100):0}% расходов на продукты</small></div>`).join('');
 const productTotals={};selected.forEach(p=>{const id=p.food||'other';productTotals[id]||={sum:0,qty:0,name:FOODS[id]?.name||'Прочие продукты',unit:FOODS[id]?.unit||'шт.'};productTotals[id].sum+=p.total;productTotals[id].qty+=p.qty;});
 $('top-products').innerHTML=Object.values(productTotals).sort((a,b)=>b.sum-a.sum).slice(0,5).map(p=>`<div class="top-product"><span>${p.name}<small>${amount(p.qty,p.unit)}</small></span><strong>${money(p.sum)}</strong></div>`).join('')||'<p class="muted">Здесь появятся продукты с наибольшими расходами.</p>';
 const months={};purchases.forEach(p=>{const month=p.date.slice(0,7);months[month]=(months[month]||0)+p.total;});
 $('history-chart').innerHTML=Object.entries(months).sort(([a],[b])=>a.localeCompare(b)).slice(-12).map(([month,total])=>`<div class="history-row"><span>${month}</span><div class="bar-track"><span style="width:${total/Math.max(1,...Object.values(months))*100}%"></span></div><strong>${money(total)}</strong></div>`).join('')||'<p class="muted">История начнется с первой покупки. Каждый месяц появится отдельной строкой.</p>';
 $('purchase-history').innerHTML=[...purchases].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<tr><td>${p.date}</td><td>${escapeText(p.food?FOODS[p.food].name:p.note||'Прочие продукты')}<small>${escapeText(p.category)}</small></td><td>${escapeText(STORES[p.store][0])}</td><td>${amount(p.qty,FOODS[p.food]?.unit||'шт.')}</td><td>${money(p.total)}</td><td><button class="text" data-remove-purchase="${escapeText(p.id)}">Отменить</button></td></tr>`).join('')||'<tr><td colspan="6">Покупки еще не записаны.</td></tr>';
}
function openPurchase(){
 $('purchase-date').value=localDate();$('purchase-store').value=state.store;$('purchase-total').value='';$('purchase-qty').value='1';$('purchase-note').value='';$('purchase-unit').textContent=FOODS[$('purchase-food').value]?.unit||'шт.';$('purchase').showModal();
}
document.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.dataset.storeCart){state.store=target.dataset.storeCart;save();render();if($('shop').open)$('shop').close();openShop();}
 if(target.dataset.removePurchase){state.purchases=(state.purchases||[]).filter(p=>p.id!==target.dataset.removePurchase);save();render();toast('Покупка удалена из фактических расходов.');}
});
document.addEventListener('change',e=>{
 if(!e.target.dataset.compareStore)return;
 const {compareStore:store,compareFood:id}=e.target.dataset;
 if(!e.target.reportValidity())return;
 state.prices[store]||={};state.priceMeta||={};state.priceMeta[store]||={};
 if(e.target.value===''){delete state.prices[store][id];delete state.priceMeta[store][id];}
 else {state.prices[store][id]=Number(e.target.value);state.priceMeta[store][id]=localDate();}
 save();render();
});
function initAnalytics(){
 $('analytics-period').onchange=renderAnalytics;
 $('add-purchase').onclick=openPurchase;$('purchase-again').onclick=openPurchase;
 $('purchase-food').innerHTML=Object.entries(FOODS).map(([id,f])=>`<option value="${id}">${f.emoji} ${f.name}</option>`).join('')+'<option value="">Другие продукты / часть чека</option>';
 $('purchase-store').innerHTML=Object.entries(STORES).map(([id,[name]])=>`<option value="${id}">${name}</option>`).join('');
 $('purchase-food').onchange=()=>{$('purchase-unit').textContent=FOODS[$('purchase-food').value]?.unit||'шт.';};
 $('purchase-form').onsubmit=e=>{
  e.preventDefault();const total=Number($('purchase-total').value),qty=Number($('purchase-qty').value),food=$('purchase-food').value;
  if(!Number.isFinite(total)||total<=0||total>100000||!Number.isFinite(qty)||qty<=0||qty>1000000)return;
  state.purchases||=[];state.purchases.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),food,category:categoryOf(food),qty,total,date:$('purchase-date').value,store:$('purchase-store').value,note:$('purchase-note').value.trim().slice(0,100)});
  save();$('purchase').close();render();toast('Фактическая покупка записана в аналитику.');
 };
}
