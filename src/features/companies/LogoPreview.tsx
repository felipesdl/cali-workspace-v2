import { type CompanyLogo } from '../../api/modules/companies/registration-schemas';
export function LogoPreview({
  logo,
  alt = 'Logo da empresa',
}: {
  logo: CompanyLogo | null;
  alt?: string;
}) {
  if (!logo) return <p className="tw:text-caption tw:text-muted-copy">Logo não informada.</p>;
  return (
    <div className="tw:grid tw:gap-2">
      <img
        src={logo.dataUrl}
        alt={alt}
        width={96}
        height={96}
        className="tw:h-24 tw:w-24 tw:rounded-media tw:border tw:border-border-default tw:bg-panel tw:object-contain"
      />
      <span className="tw:text-caption tw:wrap-anywhere tw:text-muted-copy">
        {logo.sourceName} · {logo.width} × {logo.height} px
      </span>
    </div>
  );
}
