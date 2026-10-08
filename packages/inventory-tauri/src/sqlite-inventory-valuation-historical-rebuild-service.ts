import type { DatabaseExecutor } from "@argin/database";
import {
  addInventoryStockQuantities,
  fifoInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
  type InventoryFifoLayerState,
} from "@argin/inventory";

type MovementRow = {
  movement_id:string; company_id:string; document_id:string; line_id:string;
  transfer_id:string|null; reversal_of_movement_id:string|null;
  product_id:string; warehouse_id:string; zone_id:string|null; location_id:string|null;
  business_date:string; business_order:number; recorded_at:string; quantity_delta:string;
};

type PolicyRow = {
  policy_id:string; method:"fifo"|"moving_average"; strategy_version:number;
  currency:string; effective_from:string; revision:number;
};

type CostRow = {
  movement_id:string; quantity:string; currency:string; total_cost:number; unit_cost:string;
};

interface ProductState {
  quantity:string;
  totalCost:number;
  fifoLayers:Array<{
    id:string;
    sourceMovementId:string;
    sourceEntryId:string;
    warehouseId:string;
    zoneId:string|null;
    locationId:string|null;
    businessDate:string;
    businessOrder:number;
    originalQuantity:string;
    remainingQuantity:string;
    unitCost:string;
    originalCost:number;
    remainingCost:number;
    currency:string;
  }>;
}

export interface HistoricalValuationRebuildResult {
  readonly productId:string;
  readonly rebuiltMovementCount:number;
  readonly skippedReversalPairCount:number;
  readonly earliestBusinessDate:string|null;
}

const absQty=(value:string)=>value.startsWith("-")?value.slice(1):value;
const stockKey=(m:MovementRow)=>[m.warehouse_id,m.zone_id??"",m.location_id??""].join("|");
const addQty=(a:string,b:string)=>addInventoryStockQuantities(a,b);
interface DecimalQuantity { readonly coefficient: bigint; readonly scale: number; }
function decimalQuantity(value:string):DecimalQuantity{
  const normalized=value.trim();
  const negative=normalized.startsWith("-");
  const unsigned=negative?normalized.slice(1):normalized;
  const [whole="0",fraction=""]=unsigned.split(".");
  return {
    coefficient:BigInt(`${negative?"-":""}${whole}${fraction}`),
    scale:fraction.length,
  };
}
function power10(scale:number){return 10n**BigInt(scale);}
function formatQuantity(coefficient:bigint,scale:number){
  const negative=coefficient<0n;
  const digits=(negative?-coefficient:coefficient).toString().padStart(scale+1,"0");
  const unsigned=scale===0?digits:`${digits.slice(0,-scale)}.${digits.slice(-scale)}`;
  const trimmed=scale===0?unsigned:unsigned.replace(/\.0+$/u,"").replace(/(\.\d*?)0+$/u,"$1");
  return `${negative?"-":""}${trimmed}`;
}
function compareQty(a:string,b:string){
  const left=decimalQuantity(a),right=decimalQuantity(b);
  const scale=Math.max(left.scale,right.scale);
  const aa=left.coefficient*power10(scale-left.scale);
  const bb=right.coefficient*power10(scale-right.scale);
  return aa===bb?0:aa<bb?-1:1;
}
function subQty(a:string,b:string){
  const left=decimalQuantity(a),right=decimalQuantity(b);
  const scale=Math.max(left.scale,right.scale);
  const value=
    left.coefficient*power10(scale-left.scale)
    - right.coefficient*power10(scale-right.scale);
  if(value<0n) throw new Error("VALUATION_HISTORICAL_NEGATIVE_STOCK");
  return formatQuantity(value,scale);
}
function unitCostFrom(total:number,quantity:string){
  const q=Number(quantity);
  if(!Number.isFinite(q)||q<=0) throw new Error("VALUATION_HISTORICAL_INVALID_QUANTITY");
  return String(total/q);
}
function sumFifoQty(layers:readonly InventoryFifoLayerState[]){
  return layers.reduce((sum,l)=>addQty(sum,l.remainingQuantity),"0");
}
function sumFifoCost(layers:readonly InventoryFifoLayerState[]){
  return layers.reduce((sum,l)=>sum+l.remainingCost,0);
}
function effectivePolicy(policies:readonly PolicyRow[],date:string):PolicyRow|null{
  const eligible=policies.filter(p=>p.effective_from<=date);
  return eligible.at(-1)??null;
}

export class SqliteInventoryValuationHistoricalRebuildService {
  constructor(private readonly db:DatabaseExecutor){}

  async rebuildProduct(input:{
    companyId:string;
    productId:string;
    actorId:string;
    requestId:string;
    occurredAt:string;
  }):Promise<HistoricalValuationRebuildResult>{
    const companyId=input.companyId.trim();
    const productId=input.productId.trim();
    if(!companyId||!productId||!input.actorId.trim()||!input.requestId.trim())
      throw new Error("VALUATION_HISTORICAL_REBUILD_INVALID");
    const occurredAt=new Date(input.occurredAt);
    if(!Number.isFinite(occurredAt.getTime()))
      throw new Error("VALUATION_HISTORICAL_REBUILD_INVALID_OCCURRED_AT");

    const [movements,policies]=await Promise.all([
      this.db.query<MovementRow>(
        `SELECT * FROM inventory_all_stock_movements
         WHERE company_id=? AND product_id=?
         ORDER BY business_date,business_order,document_id,line_id,movement_id`,
        [companyId,productId],
      ),
      this.db.query<PolicyRow>(
        `SELECT policy_id,method,strategy_version,currency,effective_from,revision
         FROM inventory_valuation_policies
         WHERE company_id=?
         ORDER BY effective_from,revision`,
        [companyId],
      ),
    ]);
    if(policies.length===0) throw new Error("VALUATION_HISTORICAL_REBUILD_POLICY_MISSING");
    if(movements.length===0) return Object.freeze({
      productId,rebuiltMovementCount:0,skippedReversalPairCount:0,earliestBusinessDate:null,
    });

    const reversedOriginals=new Set(
      movements.filter(m=>m.reversal_of_movement_id).map(m=>m.reversal_of_movement_id!),
    );
    const active=movements.filter(
      m=>!m.reversal_of_movement_id&&!reversedOriginals.has(m.movement_id),
    );
    const inboundIds=active
      .filter(m=>m.transfer_id===null&&!m.quantity_delta.startsWith("-")&&m.quantity_delta!=="0")
      .map(m=>m.movement_id);
    const costs=inboundIds.length===0?[]:await this.db.query<CostRow>(
      `SELECT movement_id,quantity,currency,total_cost,unit_cost
       FROM inventory_valuation_cost_inputs
       WHERE company_id=? AND movement_id IN (${inboundIds.map(()=>"?").join(",")})`,
      [companyId,...inboundIds],
    );
    const costByMovement=new Map(costs.map(c=>[c.movement_id,c]));
    const missingInbound=inboundIds.filter(id=>!costByMovement.has(id));
    if(missingInbound.length>0)
      throw new Error(`VALUATION_HISTORICAL_REBUILD_COST_MISSING:${missingInbound.length}`);

    const states=new Map<string,ProductState>();
    const entries:Array<any>=[];
    const datedStates:Array<any>=[];
    const processedTransfers=new Set<string>();

    const remember=(m:MovementRow,state:ProductState,policy:PolicyRow)=>{
      datedStates.push({
        companyId,productId,warehouseId:m.warehouse_id,zoneKey:m.zone_id??"",
        locationKey:m.location_id??"",businessDate:m.business_date,
        policyId:policy.policy_id,method:policy.method,strategyVersion:policy.strategy_version,
        currency:policy.currency,quantity:state.quantity,totalCost:state.totalCost,
      });
    };

    for(const movement of active){
      const policy=effectivePolicy(policies,movement.business_date);
      if(!policy) throw new Error("VALUATION_HISTORICAL_REBUILD_POLICY_NOT_EFFECTIVE");

      if(movement.transfer_id){
        const transferKey=`${movement.transfer_id}|${movement.line_id}`;
        if(processedTransfers.has(transferKey)) continue;
        const pair=active.filter(m=>m.transfer_id===movement.transfer_id&&m.line_id===movement.line_id);
        if(pair.length!==2) throw new Error("VALUATION_HISTORICAL_REBUILD_TRANSFER_INVALID");
        const source=pair.find(m=>m.quantity_delta.startsWith("-"));
        const destination=pair.find(m=>!m.quantity_delta.startsWith("-")&&m.quantity_delta!=="0");
        if(!source||!destination) throw new Error("VALUATION_HISTORICAL_REBUILD_TRANSFER_INVALID");
        processedTransfers.add(transferKey);

        const sourceState=states.get(stockKey(source))??{quantity:"0",totalCost:0,fifoLayers:[]};
        const destinationState=states.get(stockKey(destination))??{quantity:"0",totalCost:0,fifoLayers:[]};
        const quantity=absQty(source.quantity_delta);
        if(compareQty(sourceState.quantity,quantity)<0)
          throw new Error("VALUATION_HISTORICAL_REBUILD_NEGATIVE_STOCK");

        let carriedCost=0;
        let unitCost="0";
        if(policy.method==="fifo"){
          let result;
          try{
            result=fifoInventoryValuationStrategy.issue(
              {layers:sourceState.fifoLayers.map(l=>({
                layerId:l.id,remainingQuantity:l.remainingQuantity,remainingCost:l.remainingCost,
                currency:l.currency as InventoryFifoLayerState["currency"],
              }))},
              {quantity,currency:policy.currency as InventoryFifoLayerState["currency"]},
            );
          }catch{throw new Error("VALUATION_HISTORICAL_REBUILD_FIFO_INSUFFICIENT");}
          carriedCost=result.totalCost;
          unitCost=result.unitCost;
          const nextById=new Map(result.state.layers.map(l=>[l.layerId,l]));
          for(const layer of sourceState.fifoLayers){
            const next=nextById.get(layer.id);
            layer.remainingQuantity=next?.remainingQuantity??"0";
            layer.remainingCost=next?.remainingCost??0;
          }
          destinationState.fifoLayers.push({
            id:`fifo-transfer:${movement.transfer_id}:${movement.line_id}:${destination.movement_id}`,
            sourceMovementId:destination.movement_id,
            sourceEntryId:`valuation:${destination.movement_id}`,
            warehouseId:destination.warehouse_id,zoneId:destination.zone_id,locationId:destination.location_id,
            businessDate:destination.business_date,businessOrder:destination.business_order,
            originalQuantity:quantity,remainingQuantity:quantity,unitCost,
            originalCost:carriedCost,remainingCost:carriedCost,currency:policy.currency,
          });
        }else{
          const q=Number(quantity),sq=Number(sourceState.quantity);
          carriedCost=Math.round(sourceState.totalCost*q/sq);
          unitCost=unitCostFrom(carriedCost,quantity);
        }
        sourceState.quantity=subQty(sourceState.quantity,quantity);
        sourceState.totalCost-=carriedCost;
        destinationState.quantity=addQty(destinationState.quantity,quantity);
        destinationState.totalCost+=carriedCost;
        states.set(stockKey(source),sourceState);
        states.set(stockKey(destination),destinationState);
        entries.push(
          {m:source,kind:"transfer",quantity,unitCost,totalCost:-carriedCost,policy},
          {m:destination,kind:"transfer",quantity,unitCost,totalCost:carriedCost,policy},
        );
        remember(source,sourceState,policy);
        remember(destination,destinationState,policy);
        continue;
      }

      const key=stockKey(movement);
      const state=states.get(key)??{quantity:"0",totalCost:0,fifoLayers:[]};
      const quantity=absQty(movement.quantity_delta);
      if(quantity==="0") continue;

      if(!movement.quantity_delta.startsWith("-")){
        const cost=costByMovement.get(movement.movement_id);
        if(!cost) throw new Error("VALUATION_HISTORICAL_REBUILD_COST_MISSING");
        if(policy.method==="fifo"){
          state.fifoLayers.push({
            id:`fifo-layer:${movement.movement_id}`,
            sourceMovementId:movement.movement_id,
            sourceEntryId:`valuation:${movement.movement_id}`,
            warehouseId:movement.warehouse_id,zoneId:movement.zone_id,locationId:movement.location_id,
            businessDate:movement.business_date,businessOrder:movement.business_order,
            originalQuantity:quantity,remainingQuantity:quantity,unitCost:cost.unit_cost,
            originalCost:cost.total_cost,remainingCost:cost.total_cost,currency:cost.currency,
          });
        }
        state.quantity=addQty(state.quantity,quantity);
        state.totalCost+=cost.total_cost;
        entries.push({m:movement,kind:"inbound",quantity,unitCost:cost.unit_cost,totalCost:cost.total_cost,policy});
      }else{
        if(compareQty(state.quantity,quantity)<0)
          throw new Error("VALUATION_HISTORICAL_REBUILD_NEGATIVE_STOCK");
        let totalCost=0;
        let unitCost="0";
        if(policy.method==="fifo"){
          let result;
          try{
            result=fifoInventoryValuationStrategy.issue(
              {layers:state.fifoLayers.map(l=>({
                layerId:l.id,remainingQuantity:l.remainingQuantity,remainingCost:l.remainingCost,
                currency:l.currency as InventoryFifoLayerState["currency"],
              }))},
              {quantity,currency:policy.currency as InventoryFifoLayerState["currency"]},
            );
          }catch{throw new Error("VALUATION_HISTORICAL_REBUILD_FIFO_INSUFFICIENT");}
          totalCost=result.totalCost;
          unitCost=result.unitCost;
          const nextById=new Map(result.state.layers.map(l=>[l.layerId,l]));
          for(const layer of state.fifoLayers){
            const next=nextById.get(layer.id);
            layer.remainingQuantity=next?.remainingQuantity??"0";
            layer.remainingCost=next?.remainingCost??0;
          }
        }else{
          let result;
          try{
            result=movingAverageInventoryValuationStrategy.issue(
              {quantity:state.quantity,totalCost:state.totalCost,currency:policy.currency as never},
              {quantity,currency:policy.currency as never},
            );
          }catch{throw new Error("VALUATION_HISTORICAL_REBUILD_MWA_INVALID");}
          totalCost=result.totalCost;
          unitCost=result.unitCost;
        }
        state.quantity=subQty(state.quantity,quantity);
        state.totalCost-=totalCost;
        entries.push({m:movement,kind:"outbound",quantity,unitCost,totalCost:-totalCost,policy});
      }
      states.set(key,state);
      remember(movement,state,policy);
    }

    await this.db.transaction(async session=>{
      const replay=await session.queryOne<{outcome_id:string}>(
        "SELECT outcome_id FROM inventory_valuation_idempotency WHERE company_id=? AND request_id=?",
        [companyId,input.requestId],
      );
      if(replay) return;

      await session.execute(
        "DELETE FROM inventory_valuation_entries WHERE company_id=? AND product_id=?",
        [companyId,productId],
      );
      await session.execute(
        "DELETE FROM inventory_valuation_cost_layers WHERE company_id=? AND product_id=?",
        [companyId,productId],
      );
      await session.execute(
        "DELETE FROM inventory_valuation_states WHERE company_id=? AND product_id=?",
        [companyId,productId],
      );

      for(const entry of entries){
        const m=entry.m as MovementRow;
        const p=entry.policy as PolicyRow;
        await session.execute(
          `INSERT INTO inventory_valuation_entries(
            valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,
            reversal_of_movement_id,transfer_id,kind,method,strategy_version,currency,
            warehouse_id,zone_id,location_id,business_date,business_order,quantity,
            unit_cost,total_cost,cost_state,unresolved_reason,valued_at,revision
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
          [
            `valuation:${m.movement_id}`,companyId,productId,m.movement_id,m.document_id,m.line_id,
            null,m.transfer_id,entry.kind,p.method,p.strategy_version,p.currency,
            m.warehouse_id,m.zone_id,m.location_id,m.business_date,m.business_order,entry.quantity,
            entry.unitCost,entry.totalCost,"resolved",null,occurredAt.toISOString(),
          ],
        );
      }

      const layerIds=new Set<string>();
      for(const state of states.values()){
        for(const layer of state.fifoLayers){
          if(layerIds.has(layer.id)) continue;
          layerIds.add(layer.id);
          const policy=effectivePolicy(policies,layer.businessDate)!;
          await session.execute(
            `INSERT INTO inventory_valuation_cost_layers(
              cost_layer_id,company_id,product_id,source_movement_id,source_valuation_entry_id,
              method,strategy_version,currency,warehouse_id,zone_id,location_id,
              opened_business_date,opened_business_order,original_quantity,remaining_quantity,
              unit_cost,original_cost,remaining_cost,revision
            ) VALUES(?,?,?,?,?,'fifo',?,?,?,?,?,?,?,?,?,?,?,?,1)`,
            [
              layer.id,companyId,productId,layer.sourceMovementId,layer.sourceEntryId,
              policy.strategy_version,layer.currency,layer.warehouseId,layer.zoneId,layer.locationId,
              layer.businessDate,layer.businessOrder,layer.originalQuantity,layer.remainingQuantity,
              layer.unitCost,layer.originalCost,layer.remainingCost,
            ],
          );
        }
      }

      const latestStateByKey=new Map<string,any>();
      for(const state of datedStates){
        latestStateByKey.set(
          [state.warehouseId,state.zoneKey,state.locationKey,state.businessDate].join("|"),
          state,
        );
      }
      for(const state of latestStateByKey.values()){
        await session.execute(
          `INSERT INTO inventory_valuation_states(
            company_id,product_id,warehouse_id,zone_key,location_key,business_date,
            policy_id,method,strategy_version,currency,quantity,total_cost,unresolved_count
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,0)`,
          [
            companyId,productId,state.warehouseId,state.zoneKey,state.locationKey,state.businessDate,
            state.policyId,state.method,state.strategyVersion,state.currency,state.quantity,state.totalCost,
          ],
        );
      }

      await session.execute(
        `INSERT INTO inventory_valuation_stream_versions(company_id,stream_key,revision)
         VALUES(?,?,1)
         ON CONFLICT(company_id,stream_key)
         DO UPDATE SET revision=inventory_valuation_stream_versions.revision+1`,
        [companyId,`valuation:${companyId}:${productId}`],
      );
      await session.execute(
        `INSERT INTO inventory_valuation_idempotency(
          company_id,request_id,operation,payload_fingerprint,outcome_kind,outcome_id,outcome_revision,recorded_at
        ) VALUES(?,?,?,?,?,?,?,?)`,
        [
          companyId,input.requestId,"inventory.valuation.historical-rebuild",
          JSON.stringify({productId,movementCount:active.length}),
          "product-rebuild",productId,1,occurredAt.toISOString(),
        ],
      );
    });

    void input.actorId;
    return Object.freeze({
      productId,
      rebuiltMovementCount:entries.length,
      skippedReversalPairCount:reversedOriginals.size,
      earliestBusinessDate:active[0]?.business_date??null,
    });
  }
}
