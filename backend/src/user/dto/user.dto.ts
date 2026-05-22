import { Expose, plainToClass } from "class-transformer";
import { IsEmail, Length, Matches, MinLength } from "class-validator";

export class UserDTO {
  @Expose()
  id: string;

  @Expose()
  @Matches("^[a-zA-Z0-9_.]*$", undefined, {
    message: "Username can only contain letters, numbers, dots and underscores",
  })
  @Length(3, 32)
  username: string;

  @Expose()
  @IsEmail()
  email: string;

  @Expose()
  hasPassword: boolean;

  @MinLength(8)
  password: string;

  @Expose()
  isAdmin: boolean;

  @Expose()
  isLdap: boolean;

  ldapDN?: string;

  @Expose()
  totpVerified: boolean;

  @Expose()
  storageQuota?: number;

  @Expose()
  storageUsed: number;

  from(partial: any) {
    const result = plainToClass(UserDTO, partial, {
      excludeExtraneousValues: true,
    });
    result.isLdap = partial.ldapDN?.length > 0;
    result.storageQuota = partial.storageQuota !== undefined ? Number(partial.storageQuota) : 0;
    result.storageUsed = partial.storageUsed !== undefined ? Number(partial.storageUsed) : 0;
    return result;
  }

  fromList(partial: any[]) {
    return partial.map((part) => this.from(part));
  }
}
