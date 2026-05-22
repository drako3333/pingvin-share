import { plainToClass } from "class-transformer";
import { Allow, IsOptional, IsNumber, MinLength } from "class-validator";
import { UserDTO } from "./user.dto";

export class CreateUserDTO extends UserDTO {
  @Allow()
  isAdmin: boolean;

  @MinLength(8)
  @IsOptional()
  password: string;

  @IsOptional()
  @IsNumber()
  storageQuota?: number;

  from(partial: Partial<CreateUserDTO>) {
    return plainToClass(CreateUserDTO, partial, {
      excludeExtraneousValues: true,
    });
  }
}
