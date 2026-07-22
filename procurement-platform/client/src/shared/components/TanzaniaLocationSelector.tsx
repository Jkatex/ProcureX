/* Renders the shared Tanzania Location Selector UI while keeping page-specific presentation near its workflow data. */
import {
  getDistrictsForRegion,
  getTanzaniaRegions,
  getWardsForDistrict,
  type TanzaniaLocationSelection
} from '@procurex/shared';

type TanzaniaLocationSelectorProps = {
  value: Partial<TanzaniaLocationSelection>;
  onChange: (value: Partial<TanzaniaLocationSelection>) => void;
  idPrefix: string;
  required?: boolean;
  disabled?: boolean;
  groupClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  gridClassName?: string;
};

export function TanzaniaLocationSelector({
  value,
  onChange,
  idPrefix,
  required = false,
  disabled = false,
  groupClassName = 'form-group-new',
  labelClassName = 'form-label-new',
  inputClassName = 'form-input-new',
  gridClassName = 'tanzania-location-grid'
}: TanzaniaLocationSelectorProps) {
  const regions = getTanzaniaRegions();
  const districts = value.region ? getDistrictsForRegion(value.region) : [];
  const wards = value.region && value.district ? getWardsForDistrict(value.region, value.district) : [];

  return (
    <div className={gridClassName}>
      <label className={groupClassName} htmlFor={`${idPrefix}-region`}>
        <span className={labelClassName}>Region{required ? ' *' : ''}</span>
        <select
          id={`${idPrefix}-region`}
          className={inputClassName}
          value={value.region ?? ''}
          onChange={(event) => onChange({ region: event.target.value, district: '', ward: '' })}
          required={required}
          disabled={disabled}
        >
          <option value="">Select region</option>
          {regions.map((region) => (
            <option value={region} key={region}>
              {region}
            </option>
          ))}
        </select>
      </label>

      <label className={groupClassName} htmlFor={`${idPrefix}-district`}>
        <span className={labelClassName}>District{required ? ' *' : ''}</span>
        <select
          id={`${idPrefix}-district`}
          className={inputClassName}
          value={value.district ?? ''}
          onChange={(event) => onChange({ region: value.region ?? '', district: event.target.value, ward: '' })}
          required={required}
          disabled={disabled || !value.region}
        >
          <option value="">Select district</option>
          {districts.map((district) => (
            <option value={district} key={district}>
              {district}
            </option>
          ))}
        </select>
      </label>

      <label className={groupClassName} htmlFor={`${idPrefix}-ward`}>
        <span className={labelClassName}>Ward/shehia{required ? ' *' : ''}</span>
        <select
          id={`${idPrefix}-ward`}
          className={inputClassName}
          value={value.ward ?? ''}
          onChange={(event) => onChange({ region: value.region ?? '', district: value.district ?? '', ward: event.target.value })}
          required={required}
          disabled={disabled || !value.region || !value.district}
        >
          <option value="">Select ward/shehia</option>
          {wards.map((ward) => (
            <option value={ward} key={ward}>
              {ward}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
