

shape.registerTypeBuilder("GlobalObject", {
    native : false,
    initializer:function(type, args, memberDesc) {
        if(memberDesc && memberDesc.value){
            console.log("Initialisation of a global object member is not implemented");
        } else {
            return null;
        }
    },
    factory: function(type,args,memberDesc){
        var result = new ModelObject(type, args,false);
        makeEventEmitter(result);
        return result;
    },
    encode:function(outerObject){
        return outerObject.getPK();
    },
    decode:function(innerValue, propDesc){
        return shape.lookup(propDesc.type, innerValue);
        /*outerObject.setTime(innerValue);*/
    }
});
