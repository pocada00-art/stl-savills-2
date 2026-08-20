import { addDays, addMonths, addWeeks, addYears, isWeekend, subDays } from "date-fns";

function easterSunday(year:number){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1;
  return new Date(year,month-1,day);
}

export function spanishNationalHolidays(year:number){
  const e=easterSunday(year);
  const add=(days:number)=>{const d=new Date(e);d.setDate(d.getDate()+days);return d};
  return [
    new Date(year,0,1),new Date(year,0,6),add(-2),add(0),new Date(year,4,1),
    new Date(year,7,15),new Date(year,9,12),new Date(year,10,1),new Date(year,11,6),
    new Date(year,11,8),new Date(year,11,25)
  ];
}
function sameDay(a:Date,b:Date){return a.toDateString()===b.toDateString();}
export function isSpanishNationalHoliday(date:Date){return spanishNationalHolidays(date.getFullYear()).some(h=>sameDay(h,date));}
export function previousWorkingDay(date:Date){
  let d=new Date(date);
  while(isWeekend(d)||isSpanishNationalHoliday(d)) d=subDays(d,1);
  return d;
}
export function calculateNextDate(last:Date,frequency:string){
  const f=frequency.toLowerCase().trim();
  let next=new Date(last);
  if(f==="diario"||f==="1") next=addDays(next,1);
  else if(f==="semanal") next=addWeeks(next,1);
  else if(f==="mensual") next=addMonths(next,1);
  else if(f==="trimestral"||f==="trimensal"||f==="3") next=addMonths(next,3);
  else if(f==="semestral"||f==="6 meses") next=addMonths(next,6);
  else if(f==="anual") next=addYears(next,1);
  else if(f==="bienal"||f==="2") next=addYears(next,2);
  else if(f==="trienal"||f==="3 años") next=addYears(next,3);
  else if(f==="cuatrienal"||f==="4") next=addYears(next,4);
  else if(f==="quinquenal"||f==="5") next=addYears(next,5);
  else if(f==="decenal"||f==="10") next=addYears(next,10);
  else if(f==="quince años"||f==="15") next=addYears(next,15);
  return previousWorkingDay(next);
}
