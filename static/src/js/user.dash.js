var utils = new Utils();
window.onload = function() {
    if (!userDash) {
        userDash = new UserDashboard(document.getElementsByClassName('container')[0]);
        userDash.createDashboard();
    };
    userDash.getSubAccounts();
    userDash.getParent();
}

class UserDashboard {
    constructor(c) {
        this.container = c;
    }

    createDashboard() {
        var backHomeAchor = document.createElement('a');
        backHomeAchor.textContent = 'Home';
        backHomeAchor.href = '/login';
        this.container.appendChild(backHomeAchor);
    }

    createAddSubAccountArea() {
        var subAccountDiv = document.createElement('div');
        // subAccountDiv.appendChild(document.createTextNode('添加子账户'));
        // subAccountDiv.appendChild(document.createElement('br'));
        this.container.appendChild(subAccountDiv);

        var emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.name = 'email';
        emailInput.placeholder = 'Email';
        subAccountDiv.appendChild(emailInput);
        subAccountDiv.appendChild(document.createElement('br'));

        var pswInput = document.createElement('input');
        pswInput.type = 'password';
        pswInput.name = 'password';
        pswInput.placeholder = 'Password';
        subAccountDiv.appendChild(pswInput);
        subAccountDiv.appendChild(document.createElement('br'));

        var submitBtn = document.createElement('input');
        submitBtn.type = 'submit';
        submitBtn.value = '添加子账户';
        submitBtn.onclick = function(e) {
            userDash.addSubAccount(emailInput.value, pswInput.value);
        }
        subAccountDiv.appendChild(submitBtn);

        if (!this.subAccounts || this.subAccounts.length < 1) {
            var bindBtn = document.createElement('input');
            bindBtn.type = 'submit';
            bindBtn.value = '绑定父账户';
            bindBtn.onclick = function(e) {
                userDash.bindToParent(emailInput.value, pswInput.value);
            }
            subAccountDiv.appendChild(bindBtn);
        };
    }

    showSubAccounts(subs) {
        if (subs.length < 1) {
            return;
        };
        this.subAccounts = subs;
        var subAccountDiv = document.createElement('div');
        subAccountDiv.appendChild(document.createTextNode('子账户'));
        subAccountDiv.appendChild(document.createElement('br'));
        this.container.appendChild(subAccountDiv);
        var accTable = document.createElement('table');
        accTable.appendChild(utils.createHeaders('name', 'email', ''));
        for (var i = 0; i < this.subAccounts.length; i++) {
            var switchBtn = document.createElement('button');
            var curAccout = this.subAccounts[i];
            switchBtn.textContent = '切到' + curAccout.name;
            switchBtn.switchEmail = curAccout.email;
            switchBtn.onclick = function(e) {
                userDash.switchAccount(e.target.switchEmail);
            }
            accTable.appendChild(utils.createColsRow(curAccout.name, curAccout.email, switchBtn));
        };
        subAccountDiv.appendChild(accTable);
    }

    addSubAccount(email, pwd) {
        var queries = new FormData();
        queries.append("action", "bindsub");
        queries.append("email", email);
        queries.append('password', pwd);
        utils.post('userbind', queries, function(){
            location.reload();
        });
    }

    bindToParent(email, pwd) {
        var request = new FormData();
        request.append("action", "bindparent");
        request.append("email", email);
        request.append('password', pwd);
        utils.post('userbind', queries, function(){
            location.reload();
        });
    }

    getSubAccounts() {
        utils.get('userbind', '', function(rsp){
            userDash.showSubAccounts(JSON.parse(rsp));
        });
    }

    showParentAccount() {
        if (!this.parentAccount) {
            return;
        };

        var parentDiv = document.createElement('div');
        parentDiv.appendChild(document.createTextNode('父账户：' + this.parentAccount.name + ' Email: ' + this.parentAccount.email));
        var switchBtn = document.createElement('button');
        switchBtn.textContent = '切到父账户';
        switchBtn.onclick = function(e) {
            userDash.switchAccount(userDash.parentAccount.email);
        }
        parentDiv.appendChild(switchBtn);
        this.container.appendChild(parentDiv);
    }

    showAddSubAccounts(parent) {
        if (!parent.id) {
            this.createAddSubAccountArea();
        } else {
            this.parentAccount = parent;
            this.showParentAccount();
        };
    }

    getParent() {
        utils.get('userbind', 'type=parent', function(rsp){
            userDash.showAddSubAccounts(JSON.parse(rsp));
        });
    }

    switchAccount(email) {
        var queries = new FormData();
        queries.append("action", "switchaccount");
        queries.append("email", email);
        utils.post('userbind', queries, function(){
            window.location = 'login';
        });
    }
}

var userDash = null;