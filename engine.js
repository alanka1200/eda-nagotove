(function(root){
 const data=typeof module!=='undefined'?require('./data.js'):{FOODS,RECIPES,DAILY};
 const recipe=id=>data.RECIPES.find(r=>r.id===id);
 function generate(mode,fish=false){
  const breakfast=mode==='economy'?['oats','omelet','oats','bake','oats','omelet','oats']:['bake','omelet','oats','bake','omelet','oats','omelet'];
  const mains=mode==='economy'?['lentil','stew','chicken','lentil','pasta','stew','lentil']:['chicken','meatball','pasta','lentil','stew','chicken','meatball'];
  return Array.from({length:14},(_,day)=>({breakfast:breakfast[day%7],lunch:mains[day%7],dinner:fish&&day%7===4?'fish':mains[(day+3)%7]}));
 }
 function quantities(plan,people){
  const result={};const add=(id,qty)=>result[id]=(result[id]||0)+qty;
  plan.forEach(day=>{Object.values(day).forEach(id=>Object.entries(recipe(id).ingredients).forEach(([food,q])=>add(food,q*people)));Object.entries(data.DAILY).forEach(([id,q])=>add(id,q*people));});return result;
 }
 function basket(plan,people,pantry={},prices={}){
  return Object.entries(quantities(plan,people)).map(([id,needed])=>{
   const food=data.FOODS[id];const stock=Math.max(0,Number(pantry[id])||0);const buy=Math.max(0,needed-stock);const packs=Math.ceil(Math.max(0,buy-1e-8)/food.pack);
   const price=prices[id]??food.price;
   return {id,...food,needed,stock,buy,packs,price,cost:Math.round(packs*price*100)/100,leftover:packs*food.pack+stock-needed};
  });
 }
 const total=rows=>Math.round(rows.reduce((s,r)=>s+r.cost,0)*100)/100;
 function choose(budget,people,pantry,prices,fish){
  const variants=['varied','economy'].map(mode=>{const plan=generate(mode,fish);return {mode,plan,cost:total(basket(plan,people,pantry,prices))};});
  return variants.find(v=>v.cost<=budget)||variants.reduce((a,b)=>a.cost<b.cost?a:b);
 }
 function portions(plan,people){const counts={};plan.forEach(day=>Object.values(day).forEach(id=>counts[id]=(counts[id]||0)+people));return counts;}
 const api={generate,quantities,basket,total,choose,portions,recipe};root.MealEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
