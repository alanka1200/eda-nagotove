const $ = id => document.getElementById(id);
const KEY = 'eda-nagotove-v2';
const money = value => Math.round(value).toLocaleString('ru-RU') + ' ₽';
const amount = (value, unit) => (unit === 'г' && value >= 1000 ? (value / 1000).toLocaleString('ru-RU',{maximumFractionDigits:2}) + ' кг' : Math.round(value * 10) / 10 + ' ' + unit);
const escapeText = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultState = () => ({people:2,budget:9000,fish:false,note:'',store:'pyaterochka',pantry:{},prices:{},plan:MealEngine.generate('varied'),consumed:{},expenses:[],prep:{},start:new Date().toISOString().slice(0,10)});
function validateState(raw) {
 if (!raw || !Number.isInteger(raw.people) || raw.people<1 || raw.people>4 || !Number.isFinite(raw.budget) || raw.budget<=0 || raw.budget>200000 || !STORES[raw.store]) throw new Error('Некорректные настройки');
 const state = {...defaultState(),...raw,note:String(raw.note||'').slice(0,200)};
 if (!Array.isArray(state.plan)||state.plan.length!==14||state.plan.some(d=>!d||['breakfast','lunch','dinner'].some(slot=>!MealEngine.recipe(d[slot])||((slot==='breakfast')!==(MealEngine.recipe(d[slot]).type==='breakfast'))))) throw new Error('Некорректное меню');
 for (const [id,value] of Object.entries(state.pantry)) if(!FOODS[id]||!Number.isFinite(value)||value<0||value>1000000)throw new Error('Некорректные запасы');
 for (const [store,prices] of Object.entries(state.prices)) {if(!STORES[store])throw new Error('Неизвестный магазин');for(const [id,value] of Object.entries(prices))if(!FOODS[id]||!Number.isFinite(value)||value<0||value>100000)throw new Error('Некорректная цена');}
 if(!Array.isArray(state.expenses)||state.expenses.some(e=>!e||!['snacks','fastfood'].includes(e.type)||!Number.isFinite(e.value)||e.value<=0||e.value>100000||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)))throw new Error('Некорректные расходы');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(state.start))throw new Error('Некорректная дата');
 if(state.purchases!==undefined&&(!Array.isArray(state.purchases)||state.purchases.some(p=>!p||!STORES[p.store]||(p.food&&!FOODS[p.food])||!Object.hasOwn(FOOD_CATEGORIES,p.category)&&p.category!=='Прочее'||!Number.isFinite(p.total)||p.total<=0||p.total>100000||!Number.isFinite(p.qty)||p.qty<=0||p.qty>1000000||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))))throw new Error('Некорректные покупки');
 return state;
}
let state = defaultState();
let restored = false;
try {const raw=localStorage.getItem(KEY);if(raw){state=validateState(JSON.parse(raw));restored=true;}} catch { /* Invalid browser data is replaced by a fresh plan. */ }
let currentDay=0,currentRecipe=null,currentSlot=null,expenseType=null,toastTimer;
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{toast('Браузер не сохранил изменения. Выгрузите данные кнопкой внизу.');}}
const currentPrices = () => state.prices[state.store]||{};
const rows = () => MealEngine.basket(state.plan,state.people,state.pantry,currentPrices());
const recipePrice = r => Object.entries(r.ingredients).reduce((s,[id,q])=>s+q/FOODS[id].pack*(currentPrices()[id]??FOODS[id].price),0);
function selectTab(id){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==id);document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===id);b.setAttribute('aria-pressed',String(b.dataset.tab===id));});}
function render(){
 const basket=rows(),cost=MealEngine.total(basket),withoutStock=MealEngine.total(MealEngine.basket(state.plan,state.people,{},currentPrices()));
 const eaten=Object.keys(state.consumed).filter(k=>state.consumed[k]).length*state.people;
 $('cost').textContent=money(cost);$('saved').textContent=money(withoutStock-cost);$('portions').textContent=84/2*state.people-eaten;
 $('people-caption').textContent=`из ${42*state.people} запланированных · ${eaten} съели`;
 $('plan-caption').textContent=`${state.people} чел. · 14 дней · ${42*state.people} порций`;
 $('per-day').textContent=money(cost/(state.people*14));$('cart-count').textContent=basket.filter(r=>r.packs>0).length;
 $('budget-state').textContent=cost<=state.budget?'В бюджете · запас '+money(state.budget-cost):'Не хватает '+money(cost-state.budget);
 $('feasibility').classList.toggle('warning',cost>state.budget);
 $('feasibility').textContent=cost<=state.budget?`План укладывается в ${money(state.budget)} на продукты. Сумма ориентировочная, уточните цены упаковок перед покупкой.`:`Этот план стоит ${money(cost)}. До бюджета не хватает ${money(cost-state.budget)}. Укажите запасы, измените цены или попробуйте экономный подбор. Порции сохранены.`;
 renderToday();renderMenu();renderBasket(basket);renderPrep();renderBudget(cost);renderExtras();
}
function renderToday(){
 const titles={breakfast:'ЗАВТРАК',lunch:'ОБЕД',dinner:'УЖИН'};
 $('today-cards').innerHTML=Object.entries(state.plan[currentDay]).map(([slot,id])=>{const r=MealEngine.recipe(id),done=state.consumed[`${currentDay}-${slot}`];return `<article class="meal-card"><button class="card-image" data-recipe="${id}" data-slot="${slot}" aria-label="Открыть рецепт ${escapeText(r.name)}"><img src="assets/${r.image}.jpg" alt="${escapeText(r.name)}"><span class="meal-label">${titles[slot]}</span></button><div class="card-body"><h3>${r.name}</h3><p>${state.people} порц. · ~${money(recipePrice(r))} за порцию продуктов</p><div class="card-actions"><button class="text" data-recipe="${id}" data-slot="${slot}">Рецепт и замена ↗</button><button class="eat ${done?'done':''}" data-eat="${slot}">${done?'✓ Съели · отменить':'Съели'}</button></div></div></article>`;}).join('');
}
let menuWeek=0;
function renderMenu(){
 const labels={breakfast:'Завтрак',lunch:'Обед',dinner:'Ужин'};
 $('menu-table').innerHTML=state.plan.map((day,i)=>({day,i})).filter(({i})=>Math.floor(i/7)===menuWeek).map(({day,i})=>`<article class="day-row"><span class="day-number">${i+1}</span>${Object.entries(day).map(([slot,id])=>{const r=MealEngine.recipe(id);return `<button class="day-recipe" data-recipe="${id}" data-slot="${slot}" data-day="${i}"><img src="assets/${r.image}.jpg" alt=""><span><small>${labels[slot]}</small>${r.name}</span></button>`}).join('')}</article>`).join('');
 document.querySelectorAll('[data-week]').forEach(b=>b.classList.toggle('active',Number(b.dataset.week)===menuWeek));
 $('catalog').innerHTML=RECIPES.map(r=>`<button data-recipe="${r.id}"><img loading="lazy" src="assets/${r.image}.jpg" alt="${r.name}"><span>${r.name}<small>${r.type==='breakfast'?'Завтрак':'Обед / ужин'} · ${r.time} мин на партию</small></span></button>`).join('');
}
function renderBasket(basket){
 $('store').value=state.store;
 const search=$('food-search').value.trim().toLowerCase();
 const filtered=basket.filter(r=>r.name.toLowerCase().includes(search));
 $('basket-table').innerHTML=filtered.map(r=>`<article class="shopping-row"><div class="shopping-item"><span class="shopping-emoji" aria-hidden="true">${r.emoji}</span><div><strong>${r.name}</strong><small>В меню ${amount(r.needed,r.unit)} · дома ${amount(r.stock,r.unit)}</small></div></div><div class="shopping-qty">${r.packs?`${r.packs} уп. × ${amount(r.pack,r.unit)}`:'✓ Уже есть дома'}<small>Останется ${amount(r.leftover,r.unit)}</small></div><div class="shopping-price"><label for="price-${r.id}">Цена упаковки, ₽</label><input id="price-${r.id}" class="price-input" type="number" min="0" max="100000" step="0.01" value="${r.price}" data-price="${r.id}" aria-label="Цена упаковки ${r.name}"><a class="shopping-link" href="${foodLink(r.id,state.store)}" target="_blank" rel="noopener">${linkLabel(r.id,state.store)}</a></div><div class="shopping-total">${money(r.cost)}<button class="text" data-compare="${r.id}">Сравнить 5 сетей ↗</button></div></article>`).join('')||'<div class="empty-search">Продукт не найден. Попробуйте другое название.</div>';
 $('basket-total').textContent=money(MealEngine.total(basket));
}
function renderPrep(){
 const counts=MealEngine.portions(state.plan,state.people);
 $('prep-count').textContent=`${Object.keys(counts).length} блюд · ${42*state.people} порций вместе с гарнирами`;
 $('batch-list').innerHTML=Object.entries(counts).map(([id,count])=>{const r=MealEngine.recipe(id);return `<div class="batch-row"><input type="checkbox" data-prep="${id}" ${state.prep[id]?'checked':''} aria-label="Приготовлено ${r.name}"><img src="assets/${r.image}.jpg" alt=""><div><strong>${r.name}</strong><small>${count} порций · ${Math.ceil(count/2)} контейнеров по 2 порции</small></div><button class="text" data-recipe="${id}" data-batch="${count}">Состав ↗</button></div>`;}).join('');
}
function localDate(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function inPeriod(e){if(e.type==='fastfood')return e.date.slice(0,7)===localDate().slice(0,7);const elapsed=Math.max(0,Math.floor((Date.parse(localDate())-Date.parse(state.start))/86400000));const offset=Math.floor(elapsed/14)*14;const days=(Date.parse(e.date)-Date.parse(state.start))/86400000;return days>=offset&&days<offset+14;}
function renderBudget(cost){
 const sums={snacks:0,fastfood:0};state.expenses.filter(inPeriod).forEach(e=>sums[e.type]+=e.value);
 $('budget-food').textContent=money(cost);$('budget-remaining').textContent=cost<=state.budget?'Остаток лимита '+money(state.budget-cost):'Превышение '+money(cost-state.budget);
 $('snack-spent').textContent=money(sums.snacks);$('fast-spent').textContent=money(sums.fastfood);
 $('snack-progress').value=Math.min(1500,sums.snacks);$('fast-progress').value=Math.min(1500,sums.fastfood);
 $('all-budget').textContent=money(cost+1500+700);
 $('expenses').innerHTML=state.expenses.length?[...state.expenses].reverse().slice(0,20).map(e=>`<div class="expense-row"><div><strong>${escapeText(e.note|| (e.type==='snacks'?'Снеки':'Фастфуд'))}</strong><br>${e.date} · ${e.type==='snacks'?'К чаю':'Фастфуд'}${inPeriod(e)?'':' · прошлый период'}</div><div>${money(e.value)} <button class="text" data-remove="${escapeText(e.id)}">Отменить</button></div></div>`).join(''):'<p class="muted">Пока расходов нет. Здесь появятся ваши покупки.</p>';
}
function openSetup(){ $('input-budget').value=state.budget;$('input-people').value=state.people;$('input-fish').checked=state.fish;$('input-note').value=state.note;$('step-one').hidden=false;$('step-two').hidden=true;$('setup').showModal(); }
function buildPlan(){const pick=MealEngine.choose(state.budget,state.people,state.pantry,currentPrices(),state.fish);state.plan=pick.plan;state.consumed={};state.prep={};save();render();toast(pick.cost<=state.budget?'План собран под ваш бюджет':'Показан самый доступный из двух планов. Уточните бюджет и запасы.');}
function openRecipe(id,slot=null,day=currentDay,batch=null){
 const r=MealEngine.recipe(id);currentRecipe=id;currentSlot=slot?{slot,day}:null;
 $('recipe-image').src=`assets/${r.image}.jpg`;$('recipe-image').alt=r.name;$('recipe-type').textContent=r.type==='breakfast'?'ЗАВТРАК':'ОБЕД / УЖИН';$('recipe-name').textContent=r.name;
 $('recipe-meta').textContent=`${r.time} мин на обычную партию · ~${money(recipePrice(r))} продуктов на порцию`;
 $('recipe-note').textContent=r.note;$('recipe-servings').value=batch||state.people;
 $('recipe-thumbs').innerHTML=[r.image,'ingredients'].map((photo,i)=>`<button data-photo="${photo}" aria-label="${i?'Ингредиенты, иллюстрация':'Фото блюда'}"><img src="assets/${photo}.jpg" alt="${i?'Пример продуктов':'Блюдо'}"></button>`).join('');
 $('recipe-steps').innerHTML=r.steps.map(s=>`<li>${s}</li>`).join('');$('recipe-serve').textContent=r.serve;
 $('swap-area').innerHTML=currentSlot?`<h3>Заменить это блюдо</h3><div class="swap-options">${RECIPES.filter(a=>a.type===r.type&&a.id!==id).map(a=>`<button data-swap="${a.id}">${a.name}</button>`).join('')}</div><p class="hint">Меняется только выбранный прием пищи. Корзина и общий чек пересчитаются.</p>`:'';
 renderIngredients();$('recipe').showModal();
}
function renderIngredients(){const count=Number($('recipe-servings').value);if(!Number.isInteger(count)||count<1||count>200)return;$('recipe-ingredients').innerHTML=Object.entries(MealEngine.recipe(currentRecipe).ingredients).map(([id,q])=>`<li>${FOODS[id].emoji} ${FOODS[id].name} <strong>${amount(q*count,FOODS[id].unit)}</strong></li>`).join('');}
function openPantry(){const needed=MealEngine.quantities(state.plan,state.people);$('pantry-fields').innerHTML=Object.entries(FOODS).map(([id,f])=>`<label class="field">${f.emoji} ${f.name}, ${f.unit}<input type="number" data-stock="${id}" min="0" max="1000000" step="0.1" value="${state.pantry[id]||0}"><span class="hint">В меню ${amount(needed[id]||0,f.unit)}</span></label>`).join('');$('pantry').showModal();}
function shoppingText(){return `Еда наготове · ${state.people} чел. · 14 дней\n${STORES[state.store][0]} · цены ориентировочные\n\n`+rows().filter(r=>r.packs).map(r=>`${r.emoji} ${r.name} — ${r.packs} уп. по ${amount(r.pack,r.unit)} — ${money(r.cost)}`).join('\n')+`\n\nИтого продукты ${money(MealEngine.total(rows()))}\nДоставка, сборка и контейнеры отдельно.`;}
function openShop(){renderCompare();$('shop-text').value=shoppingText();$('shop-summary').textContent=`${STORES[state.store][0]} · ${money(MealEngine.total(rows()))} · ${rows().filter(r=>r.packs).length} позиций`;$('shop-link').href=STORES[state.store][1];$('shop').showModal();}
function download(text,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,a');if(!b)return;
 if(b.hasAttribute('data-close'))b.closest('dialog').close();
 if(b.dataset.tab)selectTab(b.dataset.tab);
 if(b.dataset.week!==undefined){menuWeek=Number(b.dataset.week);renderMenu();}
 if(b.dataset.compare){comparisonProduct=b.dataset.compare;renderCompare();$('compare-dialog').showModal();}
 if(b.dataset.action==='pantry')openPantry();
 if(b.dataset.budget)$('input-budget').value=b.dataset.budget;
 if(b.dataset.recipe)openRecipe(b.dataset.recipe,b.dataset.slot,b.dataset.day!==undefined?Number(b.dataset.day):currentDay,b.dataset.batch?Number(b.dataset.batch):null);
 if(b.dataset.eat){const key=`${currentDay}-${b.dataset.eat}`;state.consumed[key]=!state.consumed[key];save();render();}
 if(b.dataset.photo)$('recipe-image').src=`assets/${b.dataset.photo}.jpg`;
 if(b.dataset.swap){state.plan[currentSlot.day][currentSlot.slot]=b.dataset.swap;delete state.consumed[`${currentSlot.day}-${currentSlot.slot}`];state.prep={};save();$('recipe').close();render();toast('Блюдо заменено. Покупки пересчитаны.');}
 if(b.dataset.expense){expenseType=b.dataset.expense;$('expense-title').textContent=expenseType==='snacks'?'Покупка к чаю':'Поход за фастфудом';$('expense-value').value='';$('expense-note').value='';$('expense').showModal();}
 if(b.dataset.remove){state.expenses=state.expenses.filter(x=>x.id!==b.dataset.remove);save();render();}
});
document.addEventListener('change',e=>{
 if(e.target.dataset.price){const value=Number(e.target.value);if(!Number.isFinite(value)||value<0||value>100000){toast('Введите цену от 0 до 100 000 ₽');render();return;}state.prices[state.store]||={};state.prices[state.store][e.target.dataset.price]=value;state.priceMeta||={};state.priceMeta[state.store]||={};state.priceMeta[state.store][e.target.dataset.price]=localDate();save();render();}
 if(e.target.dataset.prep){state.prep[e.target.dataset.prep]=e.target.checked;save();}
});
$('setup-next').onclick=()=>{if(!$('input-budget').reportValidity())return;$('step-one').hidden=true;$('step-two').hidden=false;$('input-fish').focus();};
$('setup-back').onclick=()=>{$('step-two').hidden=true;$('step-one').hidden=false;};
$('setup-form').onsubmit=e=>{e.preventDefault();state.budget=Number($('input-budget').value);state.people=Number($('input-people').value);state.fish=$('input-fish').checked;state.note=$('input-note').value.trim();$('setup').close();buildPlan();selectTab('today');};
$('build-button').onclick=openSetup;$('settings-button').onclick=openSetup;$('rebuild').onclick=buildPlan;
$('day-select').onchange=e=>{currentDay=Number(e.target.value);renderToday();};
$('tomorrow').onclick=()=>{currentDay=Math.min(13,currentDay+1);$('day-select').value=currentDay;renderToday();};
$('recipe-servings').oninput=renderIngredients;
$('save-pantry').onclick=()=>{const fields=[...document.querySelectorAll('[data-stock]')];if(fields.some(el=>!el.reportValidity()))return;fields.forEach(el=>state.pantry[el.dataset.stock]=Number(el.value)||0);save();$('pantry').close();render();toast('Запасы учтены в сумме покупки.');};
$('food-search').oninput=()=>renderBasket(rows());
$('store').onchange=e=>{state.store=e.target.value;save();render();};
$('shop-button').onclick=openShop;
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(shoppingText());toast('Список скопирован');}catch{$('shop-text').select();toast('Выделен список. Скопируйте его вручную.');}};
$('download').onclick=()=>download(shoppingText(),'Покупки-на-14-дней.txt');
$('backup').onclick=()=>download(JSON.stringify(state,null,2),'еда-наготове-мои-данные.json','application/json');
$('import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>500000)throw new Error('Слишком большой файл');const imported=validateState(JSON.parse(await f.text()));state=imported;currentDay=0;$('day-select').value=0;save();render();toast('Данные загружены');}catch{toast('Файл не подходит. Ваши данные сохранены.');}e.target.value='';};
$('expense-form').onsubmit=e=>{e.preventDefault();const value=Number($('expense-value').value);if(!value||value<0||value>100000)return;state.expenses.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:expenseType,value,note:$('expense-note').value.trim().slice(0,100),date:localDate()});save();$('expense').close();render();const active=state.expenses.filter(x=>x.type===expenseType&&inPeriod(x));const sum=active.reduce((a,x)=>a+x.value,0);toast(expenseType==='fastfood'&&active.length>1?'Расход сохранен. Это уже второй поход в этом месяце.':sum>1500?'Расход сохранен. Лимит превышен.':'Расход сохранен');};
$('print').onclick=()=>window.print();$('about').onclick=()=>$('info').showModal();
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{const r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close();}));
$('day-select').innerHTML=Array.from({length:14},(_,i)=>`<option value="${i}">${i+1} из 14</option>`).join('');
$('store').innerHTML=Object.entries(STORES).map(([id,[name]])=>`<option value="${id}">${name}</option>`).join('');
if(!restored){state.plan=MealEngine.choose(state.budget,state.people,state.pantry,currentPrices(),state.fish).plan;}
initAnalytics();
render();
