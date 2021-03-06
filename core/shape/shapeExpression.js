ShapeExpression=function(expression){
    var expression = expression;
    //console.log(expression);
    var chains = expression.match(/(@(?:[^\W]+\.{1})*[^\W]*)/g);
    var interpretedExpress = expression;
    if(chains){
        for(var i=0;i<chains.length;i++){
            if(chains[i] == '@'){
                interpretedExpress = interpretedExpress.replace("@", "this.ctrl.model");
            }else{
                try{
                    var t = chains[i].slice(1);
                    interpretedExpress = interpretedExpress.replace(chains[i], "this.ctrl.model."+t);
                }catch(e){
                    console.log(e);
                }

            }
        }
    }

    //= expression.replace(/@/g, "this.ctrl.model.");
    var handler = null;

    var evalToDO = "var x = function(){\n" +
        "return " +interpretedExpress+";\n"+
        "}; \nx;\n";
    //console.log(evalToDO);
    handler=eval(evalToDO);
    handler = handler.bind(this);

    function callhandler(){
        try{
            var ret = handler();
            //console.log("Expression value " + ret);
            return ret;
        }catch(err){
            //wprint("Expression error " + err);
            return null;
        }
    }

    this.tryToEvaluate = function(ctrl){
      this.ctrl = ctrl;
      return callhandler();
    }

    this.bindToPlace = function(_ctrl, _onChangeHandler){
        this.ctrl = _ctrl;
        onChangeHandler = _onChangeHandler;
        if(chains){
            for(var i=0; i<chains.length;i++){
                this.ctrl.addChangeWatcher(chains[i].slice(1), function(model, prop, value, oldValue){
                    _onChangeHandler(model, prop, callhandler(), oldValue);
                });
            }
        }else{
            _onChangeHandler(this.ctrl.model, null, callhandler(), null);
        }
    }
}

function newShapeExpression(expression){
    try{
        var specialChars = expression.match(/\(|\)|@/g);

        if(specialChars){
            var open=0;
            for(var i = 0; i<specialChars.length; i++){
                if(specialChars[i]=='('){
                    open++;
                }else{
                    if(specialChars[i]==')'){
                        open--;
                    }
                }
            }
            if(open==0){
                return new ShapeExpression(expression);
            }
        }
    }catch(error){
        wprint("Syntax error in expression: "+expression);
    }
    return null;
}