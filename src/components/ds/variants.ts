export const UiVariant = {
  Primary: 'primary',
  Secondary: 'secondary',
} as const;

export type UiVariant = (typeof UiVariant)[keyof typeof UiVariant];
