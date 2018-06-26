
(function() {
  'use strict';

  /*==================================================================
  Global variables used across
  ==================================================================*/
  const currencyAPIUrlBase = 'https://';
  const currency_list = '';
  const convertBtn = $('#convertbtn'), amountInp = $('#amount'), fromDrp = $('#from_drp'), toDrp = $('#to_drp');
  let app = {
    currencyList : {},
  };
  /* end of global variable========================================*/

  /*==================================================================
  service worker functions below 
  ==================================================================*/

  /* register sw*/
  app.registerServiceWorker = ()=>{
    if (!navigator.serviceWorker) return;

    navigator.serviceWorker.register('/service-worker.js').then((reg)=> {
      if (!navigator.serviceWorker.controller) {
        return;
      }

      if (reg.waiting) {
        console.log('[ServiceWorker] is waiting - call update sw');
        app.updateWorker(reg.waiting);
        return;
      }

      if (reg.installing) {
        console.log('[ServiceWorker] is installing - call to track Installing sw');
        app.trackInstalling(reg.installing);
        return;
      }

      reg.addEventListener('updatefound', ()=> {
        console.log('[ServiceWorker] is installing - call to track Installing sw');
        app.trackInstalling(reg.installing);
      });
    });
  };

  /* track sw installing*/
  app.trackInstalling = (worker)=> {
    worker.addEventListener('statechange', function() {
      console.log('[ServiceWorker] statechange -trackInstalling');
      if (worker.state == 'installed') {
        app.updateWorker(worker);
      }
    });
  };

  /* update sw*/
  app.updateWorker = (worker)=> {
    console.log('[ServiceWorker] action to update worker called -skipWaiting');
    worker.postMessage({action: 'skipWaiting'});
  };
  /*end service worker functions====================================*/


  /*==================================================================
  Currency APi functions
  ==================================================================*/
  app.Api = ()=>{
    return {
      getCurrencyList: ()=>{
        return new Promise((resolve,reject)=>{
          fetch('https://free.currencyconverterapi.com/api/v5/currencies?').then((response)=>{ 
            response.json().then((data)=>{
                if(data){
                  resolve(data.results);
                }else{
                  reject('error fetching list');
                }
              });
          });
        });
      },
      convertCurrency: (from,to)=>{
        return new Promise((resolve,reject)=>{
          fetch(`https://free.currencyconverterapi.com/api/v5/convert?q=${from}_${to}&compact=ultra`).then((response)=>{ 
            response.json().then((data)=>{
                if(data){
                  resolve(data);
                }else{
                  reject('error fetching list');
                }
              });
          });
        });
      },
    }
  } 
  /*end currency api functions====================================*/

  /*==================================================================
  Currency ui functions
  ==================================================================*/
  /*display currency list*/
  app.displayList = (lists)=>{
    let htmlstr = '';
    for(let item of Object.keys(lists).sort()){
      let { currencyName } = lists[item];
      let opt = `<option value="${item}">${item} ( ${currencyName} )</option>`;
      htmlstr += opt;
    }
    $('select').html(htmlstr);
    $('select').formSelect();
  }
  
  app.event = ()=>{
    convertBtn.on('click', function(){
      const amount = amountInp.val();
      const from = fromDrp.val();
      const to = toDrp.val();
      if(amount.length == 0){
        //display error
        M.toast({html: 'Please specify amount!'});
        return;
      }
      app.Api().convertCurrency(from,to).then((data)=>{
        console.log(data);
        const key = Object.keys(data)[0];
        const val = data[key];
        //calculate rate
        
        return { rate: val };
      }).catch((err)=>{
        M.toast({html: err });
      });
      console.log(amount, from, to);
    })
  }
  /* app.init */
  app.init = ()=>{
    //call sw registration
    app.registerServiceWorker();
    //currency list check
    window.localforage.getItem('currencyList', function(err, list) {
      if (list) {
        console.log('offline list ', list);
        //display ui
        app.displayList(list);
      } else {        
        app.Api().getCurrencyList().then((data)=>{
          window.localforage.setItem('currencyList', data);
          console.log('online list ', data);
          //display ui
          app.displayList(data);
        });
      }
    }); 
  }

  document.addEventListener('DOMContentLoaded', function() {
    app.init();
    app.event();
  });
  
})();
