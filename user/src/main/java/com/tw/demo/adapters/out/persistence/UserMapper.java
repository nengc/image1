package com.tw.demo.adapters.out.persistence;

import com.tw.demo.adapters.out.persistence.entities.UserEntity;
import com.tw.demo.application.port.in.CreateUserCommand;
import com.tw.demo.domain.entities.User;
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

@Mapper(
        componentModel = MappingConstants.ComponentModel.SPRING//,
        //unmappedTargetPolicy = ReportingPolicy.IGNORE
)
public interface UserMapper {
    //@Mapping(target = "supplier", ignore = true)
    //CarPartDTO updateCarPartDTO(CarPart carPart, @MappingTarget CarPartDTO carPartDTO);

    User map(UserEntity userEntity);

    UserEntity map(User user);

    UserEntity map(CreateUserCommand user);

}
