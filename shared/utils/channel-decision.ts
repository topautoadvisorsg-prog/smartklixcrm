import { parsePhoneNumberFromString } from "libphonenumber-js";

export type MessagingChannel = "whatsapp" | "sms";

const LATAM_COUNTRIES = new Set([
  "MX", // Mexico
  "AR", // Argentina
  "BR", // Brazil
  "CL", // Chile
  "CO", // Colombia
  "PE", // Peru
  "VE", // Venezuela
  "EC", // Ecuador
  "GT", // Guatemala
  "CU", // Cuba
  "DO", // Dominican Republic
  "HN", // Honduras
  "SV", // El Salvador
  "NI", // Nicaragua
  "CR", // Costa Rica
  "PA", // Panama
  "PY", // Paraguay
  "UY", // Uruguay
  "BO", // Bolivia
  "PR", // Puerto Rico
]);

const SMS_PREFERRED_COUNTRIES = new Set([
  "US", // United States
  "CA", // Canada
]);

export function getPreferredChannel(phoneNumber: string, countryCode?: string | null): MessagingChannel {
  let country = countryCode?.toUpperCase();

  if (!country && phoneNumber) {
    const parsed = parsePhoneNumberFromString(phoneNumber);
    if (parsed?.country) {
      country = parsed.country;
    }
  }

  if (!country) {
    return "sms";
  }

  if (LATAM_COUNTRIES.has(country)) {
    return "whatsapp";
  }

  if (SMS_PREFERRED_COUNTRIES.has(country)) {
    return "sms";
  }

  return "sms";
}

export function getChannelLabel(channel: MessagingChannel): string {
  return channel === "whatsapp" ? "WhatsApp" : "SMS";
}
