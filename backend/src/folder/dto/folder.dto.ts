import { Expose, plainToClass, Type } from "class-transformer";
import { PublicUserDTO } from "src/user/dto/publicUser.dto";

export class FolderDTO {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  color?: string;

  @Expose()
  icon?: string;

  @Expose()
  @Type(() => PublicUserDTO)
  creator: PublicUserDTO;

  @Expose()
  createdAt: Date;

  from(partial: Partial<FolderDTO>) {
    return plainToClass(FolderDTO, partial, { excludeExtraneousValues: true });
  }

  fromList(partial: Partial<FolderDTO>[]) {
    return partial.map((part) =>
      plainToClass(FolderDTO, part, { excludeExtraneousValues: true }),
    );
  }
}
