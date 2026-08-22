const views = [...document.querySelectorAll(".view")];
const nav = [...document.querySelectorAll(".nav-item")];
const title = document.querySelector("#page-title");
const titles = {home:"判断ホーム",articles:"記事・KW",audit:"処理の監査",outcomes:"成果",placeholder:"次期画面"};
function show(id){views.forEach(v=>v.classList.toggle("active",v.id===id));nav.forEach(n=>n.classList.toggle("active",n.dataset.view===id));title.textContent=titles[id]||"WP Operations";window.scrollTo({top:0,behavior:"smooth"})}
nav.forEach(button=>button.addEventListener("click",()=>show(button.dataset.view)));
document.querySelectorAll("[data-jump]").forEach(button=>button.addEventListener("click",()=>show(button.dataset.jump)));
const dialog=document.querySelector("#gate-dialog");
document.querySelector("#open-gates").addEventListener("click",()=>dialog.showModal());
document.querySelector("#approve-button").addEventListener("click",()=>dialog.showModal());
document.querySelector("#confirm-approve").addEventListener("click",()=>{dialog.close();const toast=document.querySelector("#toast");toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),3500)});
document.querySelector("#return-button").addEventListener("click",()=>alert("prototype: 差し戻し理由の入力画面へ進みます。外部writeは行いません。"));
