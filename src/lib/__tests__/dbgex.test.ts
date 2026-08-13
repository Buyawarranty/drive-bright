import { describe, it } from 'vitest';
import { PROPOSED_AGE_BANDS, PROPOSED_MILEAGE_BANDS, PROPOSED_POWERTRAIN_FACTORS, PROPOSED_VEHICLE_TYPE_FACTORS, PROPOSED_MODEL_RISK_FACTORS, PROPOSED_MODEL_FLOORS, PROPOSED_CLAIM_LIMIT_FACTORS, PROPOSED_LABOUR_RATE_FACTORS, PROPOSED_EXCESS_FACTORS } from '@/components/admin/pricing/AgeBandPricingPreview';
import { priceFromPricingModel } from '@/components/admin/pricing/modelQuoteEngine';
const modelAt = (scale:number)=>({ageBands:PROPOSED_AGE_BANDS.map(b=>({...b,oneYear:b.oneYear==null?null:Math.round(b.oneYear*scale)})),mileageBands:PROPOSED_MILEAGE_BANDS,powertrains:PROPOSED_POWERTRAIN_FACTORS,vehicleTypes:PROPOSED_VEHICLE_TYPE_FACTORS,modelRisks:PROPOSED_MODEL_RISK_FACTORS,modelFloors:PROPOSED_MODEL_FLOORS,claimLimits:PROPOSED_CLAIM_LIMIT_FACTORS,labourRateFactors:PROPOSED_LABOUR_RATE_FACTORS,excessFactors:PROPOSED_EXCESS_FACTORS,twoYearMult:1.8,threeYearMult:2.52,payInFullFactor:1});
const vehicle={make:'Ford',model:'Focus',ageYears:6,mileage:60000,fuelType:'Petrol',vehicleType:'car'};
describe('dbg',()=>{it('prints',()=>{
 for(const t of ['12months','24months','36months']){
  console.log(t,[0,50,100,150,250,500].map(e=>priceFromPricingModel(modelAt(0.35) as any,vehicle as any,{paymentPeriod:t,claimLimit:2000,labourRate:70,voluntaryExcess:e} as any)!.totalPrice).join(','));
 }
})});
