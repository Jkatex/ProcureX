import { TenderType } from '@prisma/client';
import { getProcurementDesignFormSchema, procurementDesignSchemaVersion } from './design-form-schemas.js';
import type { DesignFormControlDto, DesignFormSectionDto, FormSchemaType, TenderDraftValidationDto } from './types.js';

export type TenderDraftValidationResult = TenderDraftValidationDto & {
  errors: string[];
  typeProfile: FormSchemaType;
};

export function tenderTypeProfile(type: TenderType): FormSchemaType {
  if (type === TenderType.WORKS) return 'works';
  if (type === TenderType.SERVICE) return 'services';
  if (type === TenderType.CONSULTANCY) return 'consultancy';
  return 'goods';
}

export function schemaMetadata(metadata: Record<string, unknown>, type: TenderType): Record<string, unknown> {
  return {
    ...metadata,
    schemaVersion: procurementDesignSchemaVersion,
    typeProfile: tenderTypeProfile(type)
  };
}

export function validateTenderDraftRequirements(type: TenderType, requirements: Record<string, unknown> | unknown): TenderDraftValidationResult {
  const typeProfile = tenderTypeProfile(type);
  const schema = getProcurementDesignFormSchema(typeProfile);
  const fields = requirementFields(typeProfile, requirements);
  const result: TenderDraftValidationResult = {
    warnings: [],
    missingRequiredFields: [],
    schemaVersion: procurementDesignSchemaVersion,
    errors: [],
    typeProfile
  };

  if (!schema) return result;

  for (const section of schema.sections) {
    if (!matchesShowWhen(section.showWhen, fields)) continue;
    for (const control of section.controls) {
      validateControl(control, fields, section, control.id, result);
    }
  }

  result.warnings.push(...result.missingRequiredFields.map((field) => `${field.label} is recommended before publishing.`));
  return result;
}

export function responseValidation(result: TenderDraftValidationResult): TenderDraftValidationDto {
  return {
    warnings: result.warnings,
    missingRequiredFields: result.missingRequiredFields,
    schemaVersion: result.schemaVersion
  };
}

function requirementFields(typeProfile: FormSchemaType, requirements: unknown): Record<string, unknown> {
  if (!isRecord(requirements)) return {};
  const typed = requirements[typeProfile];
  if (isRecord(typed) && isRecord(typed.fields)) return typed.fields;
  if (isRecord(requirements.fields)) return requirements.fields;
  return requirements;
}

function validateControl(
  control: DesignFormControlDto,
  fields: Record<string, unknown>,
  section: DesignFormSectionDto,
  path: string,
  result: TenderDraftValidationResult
) {
  if (!matchesShowWhen(control.showWhen, fields)) return;
  const value = fields[control.id];
  const hasValue = meaningfulValue(value);

  if (control.required && !hasValue) {
    result.missingRequiredFields.push({ path, label: control.label, section: section.title });
    return;
  }

  if (hasValue) validateProvidedValue(control, value, path, result);
}

function validateProvidedValue(control: DesignFormControlDto, value: unknown, path: string, result: TenderDraftValidationResult) {
  if (isTableLike(control.type)) {
    if (!Array.isArray(value)) {
      result.errors.push(`${control.label} must be an array.`);
      return;
    }
    value.forEach((row, index) => {
      if (!isRecord(row)) {
        result.errors.push(`${control.label} row ${index + 1} must be an object.`);
        return;
      }
      for (const column of control.columns ?? control.fields ?? []) {
        const nestedValue = row[column.id];
        if (column.required && !meaningfulValue(nestedValue)) {
          result.missingRequiredFields.push({ path: `${path}.${index}.${column.id}`, label: column.label, section: control.label });
        }
        if (meaningfulValue(nestedValue)) validateFieldValue(column, nestedValue, `${path}.${index}.${column.id}`, result);
      }
    });
    return;
  }

  if (control.type === 'accordion') {
    if (!isRecord(value)) {
      result.errors.push(`${control.label} must be an object.`);
      return;
    }
    for (const panel of control.panels ?? []) {
      const panelValue = value[panel.id];
      if (panel.required && !meaningfulValue(panelValue)) {
        result.missingRequiredFields.push({ path: `${path}.${panel.id}`, label: panel.label, section: control.label });
      }
      if (meaningfulValue(panelValue)) validateFieldValue(panel, panelValue, `${path}.${panel.id}`, result);
    }
    return;
  }

  validateFieldValue(control, value, path, result);
}

function validateFieldValue(control: DesignFormControlDto, value: unknown, path: string, result: TenderDraftValidationResult) {
  if (!valueMatchesType(control.type, value)) {
    result.errors.push(`${control.label} has an invalid value for ${control.type}.`);
    return;
  }

  if (control.options?.length && isOptionControl(control.type) && typeof value === 'string' && value && !control.options.includes(value)) {
    result.errors.push(`${control.label} must be one of the configured options.`);
  }

  if (path && control.type === 'date' && typeof value === 'string' && Number.isNaN(Date.parse(value))) {
    result.errors.push(`${control.label} must be a valid date.`);
  }
}

function matchesShowWhen(showWhen: DesignFormControlDto['showWhen'] | DesignFormSectionDto['showWhen'], fields: Record<string, unknown>) {
  if (!showWhen) return true;
  const value = fields[showWhen.field];
  if ('value' in showWhen) return value === showWhen.value;
  if (showWhen.values) return showWhen.values.includes(value as string | number | boolean);
  return true;
}

function valueMatchesType(type: string, value: unknown) {
  if (value === null || value === undefined || value === '') return true;
  if (['text', 'textarea', 'richtext', 'select', 'select-custom-prompt', 'source-select', 'file', 'upload-button', 'product-spec-builder'].includes(type)) {
    return typeof value === 'string' || isRecord(value) || Array.isArray(value);
  }
  if (['number', 'currency', 'calculated'].includes(type)) return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
  if (type === 'date') return value instanceof Date || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
  if (type === 'toggle') return typeof value === 'boolean';
  if (type === 'yesno') return typeof value === 'boolean' || value === 'Yes' || value === 'No';
  if (['multiselect', 'tag-select', 'list', 'repeatable-certification'].includes(type)) return Array.isArray(value);
  if (isTableLike(type)) return Array.isArray(value);
  if (type === 'accordion') return isRecord(value);
  if (type === 'index') return typeof value === 'string' || typeof value === 'number';
  return true;
}

function isOptionControl(type: string) {
  return ['select', 'source-select', 'multiselect', 'tag-select'].includes(type);
}

function isTableLike(type: string) {
  return type === 'table' || type === 'cards';
}

function meaningfulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
