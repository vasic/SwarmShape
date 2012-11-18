
registerModel("todo",{
        meta:{
            persitence:"none"
        },
        ctor:function(){
          this.current = this.active;
        },
        active:{
            type:"array",
            contains:"task"
        },
        completed:{
            type:"array",
            contains:"task"
        },
        current:{
            type:"array",
            value:"null"
        },
        newTitle:{
            type:"string"
        },
        todoCount:{
            chains:"active.onChange",
            code:function(){
                console.log("Notified by active.onChange!");
                this.todoCount = this.active.length;
                return this.active.length;
            }
        },
        pluralizer:{
            chains:"todoCount",
            code:function(){
                if(this.todoCount == 1){
                    return "";
                } else {
                    return "(s)";
                }
            }
        },
        completedCount:{
            chains:"completed.onChange",
            code:function(){
                console.log("Notified by completed.onChange!!");
                this.completedCount = this.completed.length;
                return this.completed.length;
            }
        },
        query:{
            lang:"sql",
            params:"personId",
            typeName:"Person",
            value:"select * from Tasks p where p.id={personId}"
        }
    }
);



