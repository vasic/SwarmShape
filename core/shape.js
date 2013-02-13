/*
  Framework's main class:
   Features:
     1. register dependencies: controllers, models, views (shape urls) and custom attributes plugins
     2. create objects (transient, global): newObject, newTransient
     3. shaping DOM functions:

 3.0 expandShapeComponent = function(domObj, parentCtrl, rootModel): expand a tag with shape-view attribute
 3.1 expandExistingDOM = function(domElem,parentCtrl,rootModel): do bindings and shape expansions on existing DOM elements


 */
function Shape(){
    var shapeControllers = [];
    var shape = this;
    var classRegistry = {};
    var interfaceRegistry = {};
    var typeBuilderRegistry = {};

    var dataRegistries = {};
    var shapeUrlRegistry = {};
    var shapeRegistry = {};

    var shapeAttributes = {};

    this.registerCtrl = function (name,functObj){
        //console.log("Registering controller " + name);
        shapeControllers[name] = functObj;
    }

    this.registerAttribute = function (name,functObj){
        //console.log("Registering controller " + name);
        shapeAttributes[name] = new ShapeAttribute(name,functObj);
    }

    function shapeKnowsAttribute(name){
        return shapeAttributes[name] != undefined;
    }

    function applyAttribute(name, dom,value,ctrl){
        var attr = shapeAttributes[name];
        if(attr) attr.applyAttribute(dom,value,ctrl);
    }

    this.registerModel = function(modelName,declaration,ignoreOnBuild){
        var desc = new QSClassDescription(declaration,modelName);
        classRegistry[modelName] = desc;
        if(!ignoreOnBuild){
            this.registerTypeBuilderFunction(modelName, function(memberDescription, args){
                var result;
                if(memberDescription != undefined){
                    var desc = memberDescription;
                    if(memberDescription.type){
                        if(memberDescription.value===null||memberDescription.value=="null"){
                            return null;
                        }
                        desc = shape.getClassDescription(memberDescription.type);
                    }
                    result = {};
                    try{
                        desc.attachClassDescription(result, args);
                    }catch(err){
                        dprint(err.message);
                    }
                }
                return result;
            });
        }
    }

    this.registerInterface = function(interfaceName, declaration){
        interfaceRegistry[interfaceName] = new InterfaceDescription(declaration,interfaceName);
        /* Because interfaces shouldn't be instantiated we return null every time from build function. */
        this.registerTypeBuilderFunction(interfaceName, function(){ return null});
    }

    this.registerTypeBuilderFunction = function(typeName, buildFunction){
        if(typeBuilderRegistry[typeName]){
            wprint("Shouldn't have more than one entry for "+typeName+" !");
        }
        typeBuilderRegistry[typeName] = buildFunction;
    }

    this.getClassDescription = function(modelName){
        return classRegistry[modelName];
    }

    this.getInterfaceDescription = function(modelName){
        return interfaceRegistry[modelName];
    }

    this.verifyObjectAgainstInterface = function (object, propertyName, newValue){
        var modelFields = this.getClassDescription(getMetaAttr(object,SHAPE.CLASS_NAME)).getFields();
        var newValueDesc = modelFields[propertyName];
        if(this.getInterfaceDescription(newValueDesc['type'])){
            if(!this.getInterfaceDescription(newValueDesc['type']).implementsYou(newValue)){
                dprint("You are trying to assign wrong type of object! Should implement interface "+newValueDesc['type']);
                return false;
            }
        }
        return true;
    }

    this.registerShapeURL = function(viewName,url){
        shapeUrlRegistry[viewName] = url;
    }

    this.getController = function (ctrlName, parentCtrl){
        //dprint("Creating controller " + ctrlName);
        var newCtrl         = new BaseController(ctrlName, parentCtrl);
        var base =  shapeControllers[ctrlName];
        if(base != undefined){
            for(var vn in base){
                if(typeof base[vn] == 'function'){
                    newCtrl[vn] = base[vn].bind(newCtrl);
                } else{
                    newCtrl[vn] = base[vn];
                }
            }
        } else{
            wprint("Unable to create controller " + ctrlName);
        }

        return newCtrl;
    }

    /**
     * First argument should be the event type
     */

    this.newEvent = function(){
        var args = []; // empty array
        // copy all other arguments we want to "pass through"
        for(var i = 0; i < arguments.length; i++){
            args.push(arguments[i]);
        }
        var className = arguments[0];
        if(className == undefined || classRegistry[className] == undefined){
            wprint("First argument of newEvent should be a class name!");
            return null;
        }
        var o = this.newObject.apply(this, args);
        if(o.type == undefined){
            o.type = className;
        }
        return o;
    }

    this.newMember = function(memberDesc){
        var res;
        var callFunc = typeBuilderRegistry[memberDesc.type];
        if(callFunc){
            res = callFunc(memberDesc);
        }else{
            wprint("Can't create object with type "+memberDesc.type);
        }
        return res;
    }

    this.newObject = function(className){
        var res;
        var args = []; // empty array
        // copy all other arguments we want to "pass through"
        for(var i = 1; i < arguments.length; i++){
            args.push(arguments[i]);
        }

        shapePubSub.blockCallBacks();

        try{
            var desc = shape.getClassDescription(className);
            var callFunc = typeBuilderRegistry[className];
            if(callFunc){
                res = callFunc(desc, args);
            }else{
                wprint("Can't create object with type "+className);
            }
        }catch(err){
            dprint(err);
            wprint("Creating object (or Ctor code) failed for " + className);
        }

        shapePubSub.releaseCallBacks();
        return res;
    }

    this.newTransientObject = function(className){
        var args = []; // empty array
        // copy all other arguments we want to "pass through"
        for(var i = 0; i < arguments.length; i++){
            args.push(arguments[i]);
        }
        var res = this.newObject.apply(this, args);
        if(res){
            setMetaAttr(res,"persistence", "transient");
        }
        return res;
    }

    this.newPersistentObject = function(className){
        var args = []; // empty array
        // copy all other arguments we want to "pass through"
        for(var i = 0; i < arguments.length; i++){
            args.push(arguments[i]);
        }
        var res = this.newObject.apply(this, args);
        //TODO: add in dataRegistries
        setMetaAttr(res,"persistence", "global");
        return res;
    }

    function ajaxCall(url, callBack){
        if(shapePubSub.hasChannel(url))
        {
            var subCall = function(response){
                            shapePubSub.unsub(url, subCall);
                            callBack(response.response);
                          };
            shapePubSub.sub(url, subCall);
        }else{
            shapePubSub.addChannel(url);
            $.get(url, function(response){
                callBack(response);
                shapePubSub.pub(url, {"response":response});
            });
        }
    }

    this.getShapeContent = function(shapeName, callBack){
        var requestedShapeName = shapeName;
        var content = shapeRegistry[shapeName];
        if( content == undefined){
            var fileName = shapeUrlRegistry[shapeName]
            if(fileName == undefined){
                shapeName =  shapeName + ".default";
                content = shapeRegistry[shapeName];
                if(!content){
                    fileName = shapeUrlRegistry[shapeName];
                }else{
                    callBack(content);
                    return;
                }
            }
            if(fileName != undefined) {
                ajaxCall(fileName, function(newContent){
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


    this.getPerfectShape = function(viewModel, usecase, callBack){
        var name = getMetaAttr(viewModel, SHAPE.CLASS_NAME);
        if(usecase == undefined || usecase == null){
            usecase = "default";
        }

        if(name != undefined) {
            var shapeName = name + "." + usecase;
            if(shapeUrlRegistry[shapeName] != undefined){
                this.getShapeContent(shapeName,callBack);
                return true;
            }
            shapeName = name + ".default";
            if(shapeUrlRegistry[shapeName] != undefined){
                this.getShapeContent(shapeName,callBack);
                return true;
            }
        }
        wprint("Unable to automatically detect a shape for " + J(viewModel));
        return false;
    }



    function loadInnerHtml(domObj, viewName, ctrl, parentCtrl){
        shape.getShapeContent(viewName, function(data) {
            domObj.innerHTML = data;
            if(ctrl)
            {
                bindAttributes(domObj, ctrl);
                ctrl.changeView(domObj);
            }else{
                bindAttributes(domObj, parentCtrl);
            }
        });
    }

    this.expandShapeComponent = function(domObj, parentCtrl, rootModel){
        var ctrl;
        var viewName  = $(domObj).attr("shape-view");
        var modelChain = $(domObj).attr("shape-model");
        var ctrlName  = $(domObj).attr("shape-ctrl");


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

            ctrl = shape.getController(ctrlName, parentCtrl);
            ctrl.hasTransparentModel = transparentModel;

            if(modelChain != undefined && !rootModel ){
                if(ctrl.hasTransparentModel){
                    ctrl.changeModel(parentCtrl.model);
                } else{
                    ctrl.chain = modelChain;
                }
            }

            if(parentCtrl == null || parentCtrl == undefined){
                /*ctrl.parentCtrl = ctrl;
                ctrl.ctxtCtrl = ctrl;*/
                ctrl.changeModel(rootModel);
            } else{
                ctrl.ctxtCtrl = parentCtrl.ctxtCtrl;

                if(rootModel != undefined){
                    ctrl.isCWRoot = true;
                    ctrl.changeModel(rootModel);
                } else{
                   // if(!ctrl.hasTransparentModel){
                        ctrl.addChangeWatcher("",
                            function(changedModel, modelProperty, value){
                                if(ctrl.parentCtrl != null){
                                    ctrl.parentModel = changedModel;
                                    ctrl.parentModelProperty = modelProperty;
                                }
                                ctrl.changeModel(value);
                            }
                        );
                   // }
                }
            }

            loadInnerHtml(domObj,viewName,ctrl, parentCtrl);
        }
        return ctrl;
    }


    function expandHTMLElement(domObj, parentCtrl, rootModel, expandChilds){
        var modelChain = $(domObj).attr("shape-model");
        var ctrlName  = $(domObj).attr("shape-ctrl");

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
            ctrlName =  "base/" + domObj.nodeName.toLowerCase();
        }
        var ctrl = shape.getController(ctrlName, parentCtrl);

        //cprint("New controller " + ctrl.ctrlName);


        ctrl.hasTransparentModel   = transparentModel;
        ctrl.ctxtCtrl = parentCtrl.ctxtCtrl;

        if(ctrl.hasTransparentModel){
            ctrl.changeModel(parentCtrl.model);
        } else{
            if(modelChain != undefined){
                ctrl.chain = modelChain;
            }
        }

        if(rootModel != undefined){
            ctrl.isCWRoot = true;
            ctrl.changeModel(rootModel);
        } else {
            //if(!ctrl.hasTransparentModel){
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

        if(expandChilds == true){
            bindAttributes(domObj,ctrl);
        } else{
            bindDirectAttributes(domObj,parentCtrl,ctrl);
        }
        ctrl.changeView(domObj);
        return ctrl;
    }

    this.expandExistingDOM = function(domElem,parentCtrl,rootModel){
        return expandHTMLElement(domElem,parentCtrl,rootModel,true);
    }

    function bindDirectAttributes(element,parentCtrl,ctrl){
        $(element.attributes).each (
            function() {
                var attributeName = this.name;
                var value = this.value;
                if(shapeKnowsAttribute(attributeName)){
                    //dprint("\tbindingAttribute:" + attributeName  + " value " + this.value);
                    if(value[0] == "@"){
                        value = value.substring(1);
                        if(value!=""){
                            parentCtrl.addChangeWatcher(value,
                                function(changedModel, modelProperty, value, oldValue ){
                                    //dprint("applyAttribute:" + attributeName);
                                    applyAttribute(attributeName,element,value,ctrl);
                                });
                        } else{
                            //TODO: we can detect model changes !?
                            applyAttribute(attributeName, element, parentCtrl.model,ctrl);
                        }
                    } else{
                        applyAttribute(attributeName, element, value, ctrl);
                    }
                } else {
                    if(value[0] == "@"){
                        value = value.substring(1);
                        if(value!=""){
                            parentCtrl.addChangeWatcher(value,
                                function(changedModel, modelProperty, value, oldValue ){
                                    $(element).attr(attributeName,value);
                                });
                        } else{
                            //TODO: we can detect model changes !?
                            $(element).attr(attributeName,parentCtrl.model);
                        }
                    }
                }
            });
    }



    function elementIsShapeComponent(element){
        return element.hasAttribute("shape-view");
    }

    function elementIsShapedHtmlElement(element){
        return element.hasAttribute("shape-model") ||
            element.hasAttribute("shape-ctrl") ||
            element.hasAttribute("shape-event");
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
                bindDirectAttributes(element, ctrl, ctrl);
            }
        });
        for (var i=0; i< forExpand.length; i++){
            //console.log("Element " + forExpand[i] + " get expanded" );
            shape.expandShapeComponent(forExpand[i], ctrl);
        }
    }

    /**
     * Extension of jQuery filter method that search recursively in DOM but stops when it finds expanded
     * shapes(shape-view in attributes). It uses same parameters as jQuery filter method.
     *
     * Returns an array of DOM objects that pass filter condition or if array has only one items return the DOM object.
     * */
    this.localFilter = function(node, filter){
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

    /**
     *
     * Method used to check if chain members ar described in shape's models description.
     * Returns misspelled chain link or null if the chain is ok.
     *
     * */
    this.checkChain = function(model, chain){
        var chainItems = chain.split(".");
        if(chain==""){
            wprint("Chain can't be empty!");
            return "";
        }
        var classDesc = shape.getClassDescription(getMetaAttr(model, SHAPE.CLASS_NAME));
        for(var i=0; i<chainItems.length; i++){
            if(classDesc){
                var m = classDesc.getFields()[chainItems[i]];
                if(!m){
                    return chainItems[i];
                }else{
                    classDesc = shape.getClassDescription(m.type);
                }
            }else{
                var interfaceDesc = shape.getInterfaceDescription(m.type);
                //if i find an Interface in chain a have to stop checking
                if(interfaceDesc){
                    break;
                }
                return chainItems[i];
            }
        }
        return null;
    }
}

window.shape = new Shape();
shape = window.shape;

function getBaseUrl(){
    if(shape.baseUrl  == undefined){
        var l = window.location;
        shape.baseUrl = l.protocol + "//" + l.host + "/" + l.pathname.split('/')[1];
    }
    return shape.baseUrl;
}


//cprint("Loading shape...");

function UrlHashChange(obj){
    this.type=SHAPEEVENTS.URL_CHANGE;
    for(var prop in obj){
        if(prop!= "type"){
            this[prop]=obj[prop];
        }else{
            wprint("Sorry dude, \"type\" is a keyword for hash fragments in Shape's URLs!");
        }
    }
}

function watchHashEvent(ctrl){
    $(window).bind('hashchange', function(e) {
        var fragment = window.location.hash;
        var index = fragment.indexOf("#");
        if(index == -1) {
            fragment = "";
        } else{
            fragment = fragment.substr(index+1);
        }
        ctrl.emit(new UrlHashChange(fragmentToObject(fragment)));
    });
}

function navigateUsingObject(obj){
    window.location.hash = objectToFragment(obj);
}


