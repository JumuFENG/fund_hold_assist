// import ('./a.json', {assert: { type: 'json' }}).then( m => {
//     console.log(m);
// })
if (navigator.userAgent.includes('Firefox')) {
    chrome = browser;
}

fetch('./strategies.json')
    .then(response => response.json())
    .then(m => {
        window.ses = m
    })
    .catch(error => {
        console.error('Error loading strategies.json:', error);
    });

import emjyBack from './back/emjybackend.js';
import { istrManager } from './back/istrategies.js';
emjyBack.Init();
emjyBack.log('hello world', 'testing');
