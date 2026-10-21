import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RecoverDto {
  @IsEmail() @MaxLength(255) email!: string;
}
export class PasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) senha!: string;
}
export class MfaDto {
  @IsString() @MinLength(20) @MaxLength(120) desafio!: string;
  @IsString() @MinLength(6) @MaxLength(32) codigo!: string;
}
export class DisableMfaDto extends PasswordDto {
  @IsString() @MinLength(6) @MaxLength(32) codigo!: string;
}
export class ResetDto {
  @IsString() @MinLength(20) @MaxLength(120) token!: string;
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  @MaxLength(128)
  senha!: string;
}
