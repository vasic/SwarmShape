shape.registerModel("TestViewModel",{
    tests:{
        type:"collection",
        contains:"TestDescription"
    },
    passedTests:{
        type:"collection",
        contains:"TestDescription"
    },
    failledTests:{
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