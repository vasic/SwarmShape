shape.registerModel("TestViewModel",{
    ctor:function(){
        this.createMember("tests");
        this.createMember("passedTests");
        this.createMember("failedTests");
    },
    tests:{
        type:"collection",
        contains:"TestDescription"
    },
    passedTests:{
        type:"collection",
        contains:"TestDescription"
    },
    failedTests:{
        type:"collection",
        contains:"TestDescription"
    },
    currentSelection:{
        type:"collection",
        contains:"TestDescription",
        value:null
    },
    currentIndex:{
        type:"int"
    }
});