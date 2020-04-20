var utils = new Utils();

window.onload = function () {
    var etfcontainer = document.createElement('div');
    document.body.appendChild(etfcontainer);
    etfFrm = new ETF_Frame(etfcontainer);
    etfFrm.initialize();
}

var etfFrm = null;