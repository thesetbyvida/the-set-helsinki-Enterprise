import { supabase } from "./supabase";
import type { Restaurant } from "../types/app";

export type RestaurantInput = { name:string; address:string; phone:string; email:string; color:string; logo_url:string; opening_hours:Record<string,string>; active:boolean; };

export async function listRestaurants():Promise<Restaurant[]>{ if(!supabase)return[]; const{data,error}=await supabase.from("restaurants").select("*").order("active",{ascending:false}).order("name"); if(error)throw error; return(data||[]) as Restaurant[];}
export async function createRestaurant(input:RestaurantInput):Promise<Restaurant>{ if(!supabase)throw new Error("Supabase is not configured"); const{data,error}=await supabase.from("restaurants").insert({name:input.name,address:input.address||null,phone:input.phone||null,email:input.email||null,color:input.color||"#111827",logo_url:input.logo_url||null,opening_hours:input.opening_hours,active:input.active}).select().single(); if(error)throw error; return data as Restaurant;}
export async function updateRestaurant(id:string,input:RestaurantInput):Promise<Restaurant>{ if(!supabase)throw new Error("Supabase is not configured"); const{data,error}=await supabase.from("restaurants").update({name:input.name,address:input.address||null,phone:input.phone||null,email:input.email||null,color:input.color||"#111827",logo_url:input.logo_url||null,opening_hours:input.opening_hours,active:input.active,updated_at:new Date().toISOString()}).eq("id",id).select().single(); if(error)throw error; return data as Restaurant;}
export async function setRestaurantActive(id:string,active:boolean){ if(!supabase)throw new Error("Supabase is not configured"); const{error}=await supabase.from("restaurants").update({active,updated_at:new Date().toISOString()}).eq("id",id); if(error)throw error;}
export async function deleteRestaurant(id:string){ if(!supabase)throw new Error("Supabase is not configured"); const{error}=await supabase.from("restaurants").delete().eq("id",id); if(error)throw error;}

export async function listRotaRestaurants(): Promise<Restaurant[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("rota_restaurant_directory");
  if (error) throw error;
  return ((data || []) as Array<{ id:string; name:string; active:boolean }>).map((row) => ({
    id: row.id,
    name: row.name,
    address: null,
    phone: null,
    email: null,
    color: null,
    logo_url: null,
    opening_hours: {},
    active: row.active,
    created_at: "",
    updated_at: "",
  }));
}
