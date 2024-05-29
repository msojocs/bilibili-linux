window.biliBridgePc.addListener("events/goToPage",({data:L})=>{
  switch(L==null?void 0:L.page){
    case 'Root':
      
      window.router.push({name: 'Root'});
      
      return;
  }
})