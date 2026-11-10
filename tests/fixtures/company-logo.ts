import { type CompanyLogo } from '../../src/api/admin/companies/registration-schemas';
const data =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=';
export const companyLogoFixture = {
  sourceName: 'logo-sintetica.png',
  contentType: 'image/png',
  dataUrl: `data:image/png;base64,${data}`,
  bytes: atob(data).length,
  width: 1,
  height: 1,
} satisfies CompanyLogo;
export const companyLogoFile = () =>
  new File(
    [Uint8Array.from(atob(data), (char) => char.charCodeAt(0))],
    companyLogoFixture.sourceName,
    { type: 'image/png' },
  );
