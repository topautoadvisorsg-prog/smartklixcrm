import { useState, useMemo, useEffect } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, isValidPhoneNumber, CountryCode } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const getFlagEmoji = (countryCode: string) =>
  String.fromCodePoint(...Array.from(countryCode).map(c => 127397 + c.charCodeAt(0)));

const countryNames: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  AR: "Argentina",
  BO: "Bolivia",
  BR: "Brazil",
  CL: "Chile",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  DO: "Dominican Republic",
  EC: "Ecuador",
  SV: "El Salvador",
  GT: "Guatemala",
  HN: "Honduras",
  NI: "Nicaragua",
  PA: "Panama",
  PY: "Paraguay",
  PE: "Peru",
  PR: "Puerto Rico",
  UY: "Uruguay",
  VE: "Venezuela",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  PL: "Poland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  RU: "Russia",
  ZA: "South Africa",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
  TR: "Turkey",
  PH: "Philippines",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
};

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onCountryChange?: (countryCode: string) => void;
  defaultCountry?: CountryCode;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function PhoneInput({
  value,
  onChange,
  onCountryChange,
  defaultCountry = "US",
  label,
  error,
  required = false,
  disabled = false,
  placeholder = "Phone number",
  className,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(defaultCountry);
  const [localNumber, setLocalNumber] = useState("");
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const countries = useMemo(() => {
    const allCountries = getCountries();
    return allCountries
      .map((code) => ({
        code: code as CountryCode,
        name: countryNames[code] || code,
        callingCode: getCountryCallingCode(code as CountryCode),
        flag: getFlagEmoji(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  useEffect(() => {
    if (value && value.startsWith("+")) {
      const parsed = parsePhoneNumberFromString(value);
      if (parsed) {
        setSelectedCountry(parsed.country as CountryCode || defaultCountry);
        setLocalNumber(parsed.nationalNumber);
        setIsValid(parsed.isValid());
      }
    }
  }, []);

  const handleCountryChange = (countryCode: string) => {
    const newCountry = countryCode as CountryCode;
    setSelectedCountry(newCountry);
    onCountryChange?.(newCountry);
    
    if (localNumber) {
      const callingCode = getCountryCallingCode(newCountry);
      const fullNumber = `+${callingCode}${localNumber.replace(/\D/g, "")}`;
      const parsed = parsePhoneNumberFromString(fullNumber, newCountry);
      
      if (parsed) {
        onChange(parsed.format("E.164"));
        setIsValid(parsed.isValid());
      } else {
        onChange(fullNumber);
        setIsValid(false);
      }
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const digitsOnly = inputValue.replace(/\D/g, "");
    setLocalNumber(digitsOnly);

    if (!digitsOnly) {
      onChange("");
      setIsValid(null);
      return;
    }

    const callingCode = getCountryCallingCode(selectedCountry);
    const fullNumber = `+${callingCode}${digitsOnly}`;
    const parsed = parsePhoneNumberFromString(fullNumber, selectedCountry);

    if (parsed) {
      onChange(parsed.format("E.164"));
      setIsValid(parsed.isValid());
    } else {
      onChange(fullNumber);
      setIsValid(isValidPhoneNumber(fullNumber, selectedCountry));
    }
  };

  const selectedCountryData = countries.find((c) => c.code === selectedCountry);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="flex gap-2">
        <Select
          value={selectedCountry}
          onValueChange={handleCountryChange}
          disabled={disabled}
        >
          <SelectTrigger 
            className="w-[140px] shrink-0" 
            data-testid="select-country"
          >
            <SelectValue>
              {selectedCountryData && (
                <span className="flex items-center gap-2">
                  <span>{selectedCountryData.flag}</span>
                  <span>+{selectedCountryData.callingCode}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <span className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span className="truncate">{country.name}</span>
                  <span className="text-muted-foreground">+{country.callingCode}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex-1",
            isValid === false && localNumber && "border-destructive focus-visible:ring-destructive"
          )}
          data-testid="input-phone-number"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isValid === false && localNumber && !error && (
        <p className="text-sm text-destructive">Invalid phone number for selected country</p>
      )}
      {isValid === true && localNumber && (
        <p className="text-sm text-muted-foreground">
          Formatted: {value}
        </p>
      )}
    </div>
  );
}
