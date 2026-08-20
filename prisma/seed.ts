import { PrismaClient, CountryCode, STLStatus, RoleName } from "@prisma/client";
import raw from "../data/demo-data.json";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Cargando STL SAVILLS V1 con datos reales");
  const countries = {
    España: await prisma.country.upsert({where:{code:CountryCode.ES},update:{name:"España"},create:{code:CountryCode.ES,name:"España"}}),
    Portugal: await prisma.country.upsert({where:{code:CountryCode.PT},update:{name:"Portugal"},create:{code:CountryCode.PT,name:"Portugal"}}),
  };

  for (const role of ["ADMIN","GESTOR","LECTURA"] as RoleName[]) {
    await prisma.role.upsert({where:{name:role},update:{},create:{name:role}});
  }

  const stls:any = {};
  for (const [code,name,countryId] of [
    ["STL_ES_2026_V1","STL España 2026",countries.España.id],
    ["STL_PT_2026_V1","STL Portugal 2026",countries.Portugal.id],
  ] as const) {
    stls[code]=await prisma.sTLTemplate.upsert({where:{code},update:{status:STLStatus.ACTIVE},create:{code,name,countryId,version:"2026_V1",status:STLStatus.ACTIVE}});
    const version=await prisma.sTLTemplateVersion.upsert({where:{templateId_version:{templateId:stls[code].id,version:"2026_V1"}},update:{status:STLStatus.ACTIVE},create:{templateId:stls[code].id,version:"2026_V1",status:STLStatus.ACTIVE,effectiveFrom:new Date("2026-01-01")}});
    const catalog=code.includes("_ES_")?raw.esCatalog:raw.ptCatalog;
    for(const item of catalog as any[]){
      await prisma.sTLTemplateItem.upsert({
        where:{versionId_code:{versionId:version.id,code:item.code}},
        update:{category:item.category,installationName:item.installation,actionName:item.action,frequency:item.frequency,legalReference:item.normativeReference??null,active:true},
        create:{versionId:version.id,code:item.code,category:item.category,installationName:item.installation,actionName:item.action,frequency:item.frequency,legalReference:item.normativeReference??null,active:true}
      });
    }
  }

  for (const stlCode of ["STL_ES_2026_V1","STL_PT_2026_V1"]) {
    for (const [status,score] of [["FAVORABLE",3],["CONDITIONED",2],["UNFAVORABLE",1],["PENDING",0],["NO_INFORMATION",0]] as const) {
      await prisma.complianceStatusConfig.upsert({
        where:{stlCode_status:{stlCode,status:status as any}},
        update:{score},
        create:{stlCode,status:status as any,score,active:true}
      });
    }
  }

  const frameworkES=await prisma.regulatoryFramework.findFirst({where:{countryId:countries.España.id,name:"Marco normativo España"}}) ?? await prisma.regulatoryFramework.create({data:{countryId:countries.España.id,name:"Marco normativo España",description:"Normativa técnica España"}});
  const frameworkPT=await prisma.regulatoryFramework.findFirst({where:{countryId:countries.Portugal.id,name:"Marco normativo Portugal"}}) ?? await prisma.regulatoryFramework.create({data:{countryId:countries.Portugal.id,name:"Marco normativo Portugal",description:"Normativa técnica Portugal"}});

  for(const c of raw.centers as any[]){
    const country=c.country==="España"?countries.España:countries.Portugal;
    const framework=c.country==="España"?frameworkES:frameworkPT;
    const stl=stls[c.stl];
    const center=await prisma.shoppingCenter.upsert({
      where:{code:c.code},
      update:{name:c.name,shortCode:c.shortCode,address:c.address,property:c.property,manager:c.manager,countryId:country.id,stlId:stl.id,frameworkId:framework.id,status:"ACTIVE"},
      create:{code:c.code,name:c.name,shortCode:c.shortCode,address:c.address,property:c.property,manager:c.manager,countryId:country.id,stlId:stl.id,frameworkId:framework.id,status:"ACTIVE"}
    });
    const version=await prisma.sTLTemplateVersion.findFirst({where:{templateId:stl.id,version:"2026_V1"},include:{items:true}});
    if(version){
      for(const item of version.items){
        await prisma.centerElement.upsert({where:{centerId_stlItemId:{centerId:center.id,stlItemId:item.id}},update:{},create:{centerId:center.id,stlItemId:item.id,active:true}});
      }
    }
  }
  console.log(`✅ ${raw.centers.length} centros cargados · ES ${raw.esCatalog.length} elementos · PT ${raw.ptCatalog.length} elementos`);
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
