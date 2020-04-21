var utils = new Utils();

window.onload = function () {
    etfFrm = new ETF_Frame();
    etfFrm.createPage(false);
    etfFrm.getAllCandidateStocks();
}

var etfFrm = null;