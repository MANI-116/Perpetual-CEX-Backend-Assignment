import { z } from "zod";
export class Order{

    constructor (public userId: string,public symbol: string,public side:"short"|"long",public type: "market"|"limit",public price: number,public quantity:number,public leverage: number, public postOnly: boolean,public clientOrderId: string){

    }
  
};


export interface Market{
    symbol:string,
    name:string
} 

export type EngineEvent = "createOrder"|"cancelOrder"
export class LevelData<T>{
    totalQty:number
    list:T[]

    constructor(){
        this.totalQty = 0;
        this.list = []
    }

    addNode(node:T){
        this.list.push(node);
    }
}


export class OrderBook{
    longs:Map<number,LevelData<Order>>
    shorts:Map<number,LevelData<Order>>
    bidTree:number[]
    askTree:number[]
    positions:Map<number,LevelData<Position>>

    constructor(public symbol:string){
        this.longs = new Map<number,LevelData<Order>>();
        this.shorts = new Map<number,LevelData<Order>>()
        this.positions = new Map<number,LevelData<Position>>();
        this.askTree = [],
        this.bidTree =[]
    }

    addOrder(order:Order){
        const priceLevel = order.price;
        let levelData = order.side === "short" ? this.shorts.get(priceLevel) : this.longs.get(priceLevel);
        
        if(!levelData){
            //create level and push price to specific tree
            levelData =  new LevelData<Order>(); 
            levelData.addNode(order);
            if(order.side==="short"){
                this.askTree.push(priceLevel);
                this.askTree.sort()
            }else{
                this.bidTree.push(priceLevel)};
                this.bidTree.sort();
        }
        order.side === "short" ? this.shorts.set(priceLevel,levelData):this.longs.set(priceLevel,levelData);
        return
        
    }
    
}


export const orderSchema = z.object({
    
  userId: z.string().min(1).max(70),
  symbol: z.string().min(1).max(70),
  side: z.enum(["short","long"]),
  type: z.enum(["limit","market"]),
  price: z.number(),
  quantity: z.number(),
  leverage: z.number(),
  postOnly: z.boolean(),
  clientOrderId: z.string()

})

export interface User{
    userId:string,
    account:{
        availableBalance:number,
        lockedMargin:number
    }
}
export const createUserSchema = z.object({
  userId: z.string(),
  initialBalance: z.number()
})

export type RequestOrder = z.infer<typeof orderSchema>
export type OrderStatus = "resting"|"filled"|"partially_filled"|"cancelled"|"rejected"
export interface OrderResponse{
  orderId: string,
  status:OrderStatus ,
  reason: string,
  fills: [
    {
      price: number,
      quantity: number,
      makerOrderId: string,
      makerUserId: string,
      takerUserId: string
    }
  ],
  remainingQuantity: number,
  cancelledQuantity: number,
  margin: {
    locked: number,
    used: number,
    released: number
  }
}