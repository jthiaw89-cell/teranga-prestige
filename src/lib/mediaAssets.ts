import avatarInstructorIbrahima from '../assets/images/avatar_instructor_ibrahima_1795100808153.jpg';
import avatarInstructorNdeye from '../assets/images/avatar_instructor_ndeye_1795100808407.jpg';
import avatarProviderKhady from '../assets/images/avatar_provider_khady_1795100811591.jpg';
import avatarProviderSerigne from '../assets/images/avatar_provider_serigne_1795100808386.jpg';
import courseCloudCyber from '../assets/images/course_cloud_cyber_1794940322970.jpg';
import courseEventsProtocol from '../assets/images/course_events_protocol_1794940323026.jpg';
import courseSyscohadaFinance from '../assets/images/course_syscohada_finance_1794940307275.jpg';
import logoCompanySaveurs from '../assets/images/logo_company_saveurs_1795100811359.jpg';
import logoCompanyTeranex from '../assets/images/logo_company_teranex_1795100810852.jpg';
import logoOrgAcademy from '../assets/images/logo_org_academy_1795100810596.jpg';
import logoOrgPublicAdmin from '../assets/images/logo_org_public_admin_1795100810727.jpg';
import logoOrgSonatelBiz from '../assets/images/logo_org_sonatel_biz_1795100811818.jpg';
import logoOrgTeranga from '../assets/images/logo_org_teranga_1795100810532.jpg';
import serviceDecorScenographie from '../assets/images/service_decor_scenographie_1794941483444.jpg';
import serviceDjSonorisation from '../assets/images/service_dj_sonorisation_1794941483737.jpg';
import serviceTraiteurGala from '../assets/images/service_traiteur_gala_1794941483603.jpg';

const BUNDLED_MEDIA_MAP: Record<string, string> = {
  '/src/assets/images/avatar_instructor_ibrahima_1795100808153.jpg': avatarInstructorIbrahima,
  '/src/assets/images/avatar_instructor_ndeye_1795100808407.jpg': avatarInstructorNdeye,
  '/src/assets/images/avatar_provider_khady_1795100811591.jpg': avatarProviderKhady,
  '/src/assets/images/avatar_provider_serigne_1795100808386.jpg': avatarProviderSerigne,
  '/src/assets/images/course_cloud_cyber_1794940322970.jpg': courseCloudCyber,
  '/src/assets/images/course_events_protocol_1794940323026.jpg': courseEventsProtocol,
  '/src/assets/images/course_syscohada_finance_1794940307275.jpg': courseSyscohadaFinance,
  '/src/assets/images/logo_company_saveurs_1795100811359.jpg': logoCompanySaveurs,
  '/src/assets/images/logo_company_teranex_1795100810852.jpg': logoCompanyTeranex,
  '/src/assets/images/logo_org_academy_1795100810596.jpg': logoOrgAcademy,
  '/src/assets/images/logo_org_public_admin_1795100810727.jpg': logoOrgPublicAdmin,
  '/src/assets/images/logo_org_sonatel_biz_1795100811818.jpg': logoOrgSonatelBiz,
  '/src/assets/images/logo_org_teranga_1795100810532.jpg': logoOrgTeranga,
  '/src/assets/images/service_decor_scenographie_1794941483444.jpg': serviceDecorScenographie,
  '/src/assets/images/service_dj_sonorisation_1794941483737.jpg': serviceDjSonorisation,
  '/src/assets/images/service_traiteur_gala_1794941483603.jpg': serviceTraiteurGala,
};

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (BUNDLED_MEDIA_MAP[trimmed]) return BUNDLED_MEDIA_MAP[trimmed];
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:') || trimmed.startsWith('/assets/')) {
    return trimmed;
  }
  return trimmed;
}

export const MEDIA_ASSETS = {
  avatarInstructorIbrahima,
  avatarInstructorNdeye,
  avatarProviderKhady,
  avatarProviderSerigne,
  logoCompanySaveurs,
  logoCompanyTeranex,
  logoOrgAcademy,
  logoOrgPublicAdmin,
  logoOrgSonatelBiz,
  logoOrgTeranga,
};
