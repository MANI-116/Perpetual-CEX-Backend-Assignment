import express from "express"
import {z, ZodError} from "zod"
import {type User,Order,type Market, OrderBook, createUserSchema, orderSchema,type OrderResponse,type EngineEvent, type RequestOrder, LevelData } from "./types"
const app = express();

const users:User[] =[];

app.post("api/reset",(req,res)=>{
    //Reset all users, balances, positions, orders, funding, insurance fund, and ADL events
    return res.status(200).json({ "ok": true })

});




app.post("/api/users",(req,res)=>{

    try {
        const parsedData = createUserSchema.parse(req.body);

        users.push({userId:parsedData.userId, account:{availableBalance:parsedData.initialBalance,lockedMargin:0}});

        res.status(200).json({userId:parsedData.userId})

    } catch (error) {

        if(error instanceof ZodError){
            return res.status(400).send(error.message);
        }
        
        return res.status(500).send("something went wrong from ourside")
    }

})


const markets:Market[] =[];


app.post("/api/orders",(req,res)=>{

    try {
        const parsedData = orderSchema.parse(req);
        const response:OrderResponse = engine({event:"createOrder",payload:parsedData});

        return res.status(200).json(response);
    } catch (error) {
        if(error instanceof ZodError){
            return res.status(400).send(error.message);
        }
        
        return res.status(500).send("something went wrong from ourside")
        
    }

})

const orderBooks = new Map<string,OrderBook>();
function engine({event,payload}:{event:EngineEvent, payload:RequestOrder}){

    if(event === "createOrder"){

        if(payload.type === "market"){

        }else if(payload.type === "limit"){
            //check market exists
            const market = markets.filter((m)=>m.symbol===payload.symbol)[0];
            if(!market) return { reason:"market not Found"}
            //lock user balance
            const user:User|undefined = users.filter((u)=>{return u.userId === payload.userId})[0];
            if(!user){
                return {status:"rejected",reason:"no user FOund"}
            }

            

            //lock balances
            const initialMargin = (payload.quantity * payload.price)/payload.leverage;

            if(user.account.availableBalance >= initialMargin){
                user.account.availableBalance -= initialMargin;
                user.account.lockedMargin += initialMargin;
            }else{
                return { reason:"noy enough balance"};
            }
            let orderBook = orderBooks.get(payload.symbol);
            if(!orderBook){
                orderBook = new OrderBook(payload.symbol);
                orderBooks.set(payload.symbol,orderBook);

            }
            //send to the matching engine
            const response = matchingEngine(payload,orderBook,user);
        }

    }
}


function placeInOrderBook(orderBook:OrderBook,order:Order){
      order.side === "short" ? orderBook.addOrder(order) : orderBook.addOrder(order);
            

}

interface Fill    {
      price: number,
      quantity: number,
      makerOrderId:string,
      makerUserId: string,
      takerUserId: string
    }

function transact(takerOrder:Order,makerOrder:Order,quantity:number){

}
function execute(takerOrder:Order,makersLeveldata:LevelData<Order>){

    const fills:Fill[] =[];

    for(let i = 0 ; i< makersLeveldata.list.length;i++){
        const makerOrder = makersLeveldata.list[0]!;
        const availbleQuantity = makerOrder.quantity;
        if(availbleQuantity >= takerOrder.quantity){
            //completely filled
            transact(takerOrder,makerOrder,takerOrder.quantity)
        }else{
            //partial filled
            transact(takerOrder,makerOrder,availbleQuantity)
        }
    }



}
function matchingEngine(order:Order,orderBook:OrderBook,user:User){

    if(order.type === "market"){

    }else{
     //check oppsite level found else place order in order book
        const opSideLevelData = order.side ==="short"? orderBook.longs.get(order.price):orderBook.shorts.get(order.price);
       //empty Order Book
        if(opSideLevelData === undefined){
            //create order and place it in the orderbook:
            placeInOrderBook(orderBook,order);
            return { event:"order_accepted"}
          
        }
     //execute order in fifo 
     //fetch the bestprice from oppsite level
     if(order.side === "short"){
        const maxBid = orderBook.bidTree[orderBook.bidTree.length-1]; 
        if(!maxBid){
            placeInOrderBook(orderBook,order);
            return { event:"order_accepted"};
        }
        if(maxBid <= order.price){
            execute(order,opSideLevelData);
        }
     }else{
        const minAsk = orderBook.askTree[0];
        if(!minAsk){
            placeInOrderBook(orderBook,order);
            return { event:"order_accepted"};
        }

        if(minAsk <= order.price){
            execute(order,opSideLevelData)
        }else{
            placeInOrderBook(orderBook,order);
            return {event:"order_accepted"};
        }
     }
    }

}
