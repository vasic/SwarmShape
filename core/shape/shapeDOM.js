
ShapeUtil.prototype.initDOMHandling = function(){
    var shapeControllers = [];
    var shapeUrlRegistry = {};
    var shapeRegistry = {};
    var shapeAttributes = {};
    Shape.prototype.registerCtrl = function (name,functObj){
        //console.log("Registering controller " + name);
        shapeControllers[name] = functObj;
    }

    Shape.prototype.registerAttribute = function (name,functObj){
        //console.log("Registering controller " + name);
        shapeAttributes[name] = new ShapeAttribute(name,functObj);
    }

    Shape.prototype.shapeKnowsAttribute = function(name){
        return shapeAttributes[name] != undefined;
    }


    function elementIsShapedHtmlElement(element){
        var attributes = element.attributes;
        for(var i=0; i<attributes.length;i++){
            var attr = shapeAttributes[attributes[i].name];
            if(attr&&attr.expandHTMLTag){
                return true;
            }
        }
        return false;
    }

    Shape.prototype.applyAttribute = function(name, dom,value,ctrl){
        var attr = shapeAttributes[name];
        if(attr) attr.applyAttribute(dom,value,ctrl);
    }

    Shape.prototype.registerShapeURL = function(viewName,url){
        viewName = viewName.replace(/\/|\ /,".");
        shapeUrlRegistry[viewName] = url;
    }

    Shape.prototype.getController = function (ctrlName, parentCtrl, isCWRoot){
        //dprint("Creating controller " + ctrlName);
        var newCtrl         = new BaseController(ctrlName, parentCtrl);
        var base =  shapeControllers[ctrlName];

        function getSafeFunction(funct){
            return  function(){
                shapePubSub.blockCallBacks();
                var args = ShapeUtil.prototype.mkArgs(arguments);
                var result = funct.apply(newCtrl,args);
                shapePubSub.releaseCallBacks();
                return result;
            }
        }

        if(base != undefined){
            for(var vn in base){
                if(typeof base[vn] == 'function'){
                    newCtrl[vn] =  getSafeFunction(base[vn]);
                } else{
                    newCtrl[vn] = base[vn];
                }
            }
        }
        newCtrl.isCWRoot = isCWRoot;
        return newCtrl;
    }

    function ajaxCall(key, url, callBack){
        if(shapePubSub.hasChannel(key))
        {
            var subCall = function(response){
                shapePubSub.unsub(key, subCall);
                callBack(response.response);
            };
            shapePubSub.sub(key, subCall);
        }else{
            shapePubSub.addChannel(key);
            /*var stack = printStackTrace();*/
            $.get(url, function(response){
                /*stack;*/
                callBack(response);
                shapePubSub.pub(key, {"response":response});
            });
        }
    }

    function getShapeContent(shapeName, callBack){
        shapeName = shapeName.replace(/\/|\ /,".");

        var requestedShapeName = shapeName;
        var content = shapeRegistry[shapeName];
        if( content == undefined){
            var fileName = shapeUrlRegistry[shapeName];
            if(fileName != undefined) {
                ajaxCall(shapeName,fileName, function(newContent){
                    shapeRegistry[shapeName] = newContent;
                    shapeRegistry[requestedShapeName] = newContent;
                    callBack(newContent);
                });
            } else{
                wprint("Could not find html view:" + shapeName);
            }
        } else {
            callBack(content);
        }
    }


    Shape.prototype.getPerfectShape = function(viewName,viewModel, usecase, callBack){
        if(viewModel==undefined||viewModel==""){
            callBack("");
            return;
        }
        var name = viewName;
        if(!name){
            name = ShapeUtil.prototype.getType(viewModel);
        }
        if(name==undefined){
            name  = typeof viewModel;
        }
        var result = this.getShapeByName(name, usecase, callBack);
        if(!result){
            wprint("Unable to automatically detect a shape for type " + name);
        }
        return result;
    }

    Shape.prototype.getShapeByName = function(shapeName, usecase, callBack){
        var name = shapeName;
        if(name != undefined) {
            shapeName = name + "." + usecase;
            if(shapeUrlRegistry[shapeName] != undefined){
                getShapeContent(shapeName,callBack);
                return true;
            }
            shapeName = name;
            if(shapeUrlRegistry[shapeName] != undefined){
                getShapeContent(shapeName,callBack);
                return true;
            }
            shapeName = name + ".default";
            if(shapeUrlRegistry[shapeName] != undefined){
                getShapeContent(shapeName,callBack);
                return true;
            }
            var chains=name.split('.');
            var shortName = chains[chains.length-1];

            shapeName = name + "." + shortName;
            if(shapeUrlRegistry[shapeName] != undefined){
                getShapeContent(shapeName,callBack);
                return true;
            }
        }
        wprint("Could not find html view:" + shapeName);
        return false;
    }

    function loadInnerHtml(domObj, viewName, ctrl, parentCtrl){
        var usecase = ctrl?ctrl.getContextName():"";
        var callBack = function(data) {
            domObj.innerHTML = data;
            if(ctrl){
                bindAttributes(domObj, ctrl);
                ctrl.changeView(domObj);
            }else{
                bindAttributes(domObj, parentCtrl);
                parentCtrl.afterExpansion(parentCtrl);
            }
        };
        if(parentCtrl){
            parentCtrl.waitExpansion(1);
        }
        if(viewName == undefined){
            shape.getPerfectShape(viewName /* refactor to remove viewName from arguments!*/, ctrl.model, usecase, callBack);
        }else{
            shape.getShapeByName(viewName, usecase, callBack);
        }
    }

    function ctrlExist(ctrlName){
        if(ctrlName){
            var ctrlDesc =  shapeControllers[ctrlName];
            if(!ctrlDesc){
                wprint("Unable to create controller " + ctrlName);
            }
        }
    }

    Shape.prototype.expandShapeComponent = function(domObj, parentCtrl, rootModel){
        var ctrl;
        var viewName  = $(domObj).attr("shape-view");
        var modelChain = $(domObj).attr("shape-model");
        var ctrlName  = $(domObj).attr("shape-ctrl");
        var context = $(domObj).attr("shape-context");
        var isCWRoot = (rootModel != undefined);


        ctrlExist(ctrlName);

        if(parentCtrl && parentCtrl.isController == undefined){
            wprint("Wtf? Give me a proper controller!");
        }


        var transparentModel = false;
        if(modelChain != undefined){
            if(modelChain != "@"){
                modelChain = modelChain.substring(1);
            } else {
                transparentModel = true;
            }
        } else {
            transparentModel = true;
        }

        if(rootModel){
            transparentModel = false;
        }

        //do not create useless controllers if the element is used just to expand a component
        if(parentCtrl!= null && ctrlName == undefined && transparentModel){
            // we just expand but don't create any controller
            ctrl = null;
            loadInnerHtml(domObj, viewName, ctrl, parentCtrl);

        } else {
            if(ctrlName == undefined){
                ctrlName = viewName;
            }
            ctrl = shape.getController(ctrlName, parentCtrl,isCWRoot);
            ctrl.autoViewName = viewName;
            ctrl.hasTransparentModel = transparentModel;

            if(modelChain != undefined && !rootModel ){
                if(ctrl.hasTransparentModel){
                    ctrl.changeModel(parentCtrl.model);
                } else{
                    if(shape.isChainExpression(modelChain)){
                        ctrl.chain = modelChain;
                    }else{
                        ctrl.chain = "";
                    }
                }
            }

            if(parentCtrl == null || parentCtrl == undefined){
                /*ctrl.parentCtrl = ctrl;
                 ctrl.ctxtCtrl = ctrl;*/
                ctrl.changeModel(rootModel);
            } else{
                ctrl.ctxtCtrl = parentCtrl.ctxtCtrl;

                if(rootModel != undefined){
                    //ctrl.isCWRoot = true;
                    ctrl.changeModel(rootModel);
                } else{
                    if(isCWRoot){
                        var goodChain = ctrl.chain;
                        if(goodChain == undefined){
                            goodChain == "";
                        }
                        ctrl.parentCtrl.addChangeWatcher(goodChain ,
                            function(changedModel, modelProperty, value){
                                ctrl.changeModel(value);
                            }
                        );
                    }    else{
                        ctrl.addChangeWatcher("",
                            function(changedModel, modelProperty, value){
                                if(ctrl.parentCtrl != null){
                                    ctrl.parentModel = changedModel;
                                    ctrl.parentModelProperty = modelProperty;
                                }
                                ctrl.changeModel(value);
                            }
                        );
                    }
                }
            }

            if(context){
                BaseController.prototype.bindAttribute(ctrl, {name:"shape-context", value:context}, domObj, parentCtrl);
            }
            loadInnerHtml(domObj,viewName,ctrl, parentCtrl);
        }
        return ctrl;
    }

    Shape.prototype.expandExistingDOM = function(domElem,parentCtrl,rootModel){
        return expandHTMLElement(domElem,parentCtrl,rootModel,true);
    }

    function expandHTMLElement(domObj, parentCtrl, rootModel, expandChilds){
        var modelChain = $(domObj).attr("shape-model");
        var ctrlName  = $(domObj).attr("shape-ctrl");
        var context  = $(domObj).attr("shape-context");
        var isCWRoot = (rootModel != undefined);
        ctrlExist(ctrlName);



        if(parentCtrl.isController == undefined){
            wprint("Wtf? Give me a proper controller!");
        }

        var transparentModel = false;

        if(modelChain != undefined){
            if(modelChain != "@"){
                modelChain = modelChain.substring(1);
            } else{
                transparentModel = true;
            }
        } else {
            transparentModel = true;
        }


        if(ctrlName == undefined){
            if( ($(domObj).is('div') || $(domObj).is('span') ) && $(domObj).attr("shape-view") == undefined && !transparentModel){
                ctrlName = "DynamicController";
                isCWRoot = true;
            }else{
                ctrlName =  "base/" + domObj.nodeName.toLowerCase();
            }
        }
        var ctrl = shape.getController(ctrlName, parentCtrl, isCWRoot);
        ctrl.autoViewName = undefined;
        ctrl.forbidAnotherExpansion = true;

        ctrl.hasTransparentModel   = transparentModel;
        ctrl.ctxtCtrl = parentCtrl.ctxtCtrl;
        if(parentCtrl){
            parentCtrl.waitExpansion(1);
        }
        if(ctrl.hasTransparentModel){
            ctrl.changeModel(parentCtrl.model);
        } else{
            if(modelChain != undefined){
                if(shape.isChainExpression(modelChain)){
                    ctrl.chain = modelChain;
                }else{
                    ctrl.chain = "";
                }
            }
        }

        if(rootModel != undefined){
            ctrl.changeModel(rootModel);
        } else {
            if(isCWRoot){
                var goodChain = ctrl.chain;
                if(goodChain == undefined){
                    goodChain == "";
                }
                ctrl.parentCtrl.addChangeWatcher(goodChain,
                    function(changedModel, modelProperty, value){
                        ctrl.changeModel(value);
                    }
                );
            }

            ctrl.addChangeWatcher("",
                function(changedModel, modelProperty, value){
                    if(ctrl.parentCtrl != null){
                        ctrl.parentModel = changedModel;
                        ctrl.parentModelProperty = modelProperty;
                    }
                    ctrl.changeModel(value);
                }
            );
            //}
        }

        if(context){
            BaseController.prototype.bindAttribute(ctrl, {name:"shape-context", value:context}, domObj, parentCtrl);
        }

        ctrl.waitExpansion(1);
        ctrl.changeView(domObj);
        if(expandChilds == true){
            bindAttributes(domObj,ctrl);
        } else{
            ctrl.bindDirectAttributes(domObj,parentCtrl);
        }
        ctrl.afterExpansion(ctrl);

        return ctrl;
    }

    function elementIsShapeComponent(element){
        return element.hasAttribute("shape-view");
    }

    function bindAttributes(domObj, ctrl){
        var forExpand = [];
        if(ctrl.ctrlName == undefined){
            wprint("Wrong controller ",true);
        };

        $(domObj).find("*").each(function(index){
            var element = this;
            if(elementIsShapeComponent(element)){
                if(domObj != element){
                    forExpand.push(element);
                }
            } else
            if(elementIsShapedHtmlElement(element)){
                expandHTMLElement(element, ctrl);
            } else {
                ctrl.bindDirectAttributes(element, ctrl);
            }
        });
        for (var i=0; i< forExpand.length; i++){
            //console.log("Element " + forExpand[i] + " get expanded" );
            shape.expandShapeComponent(forExpand[i], ctrl);
        }
    }
    Shape.prototype.bindAttributes = bindAttributes;

    /**
     * Extension of jQuery filter method that search recursively in DOM but stops when it finds expanded
     * shapes(shape-view in attributes). It uses same parameters as jQuery filter method.
     *
     * Returns an array of DOM objects that pass filter condition or if array has only one items return the DOM object.
     * */
    Shape.prototype.localFilter = function(node, filter){
        var result = [];
        function innerFilter(innerNode, skip){
            //node = $(node);
            try{
                if(!innerNode.attr('shape-view')||skip){
                    //result = result.concat(node.children().filter(filter));
                    $.merge(result, innerNode.children().filter(filter));
                    innerNode.children().each(function(idx){innerFilter($(this))});
                }
            }catch(e){
                dprint(e.message);
            }
        }
        innerFilter($(node), true);
        return result;
    }
}
