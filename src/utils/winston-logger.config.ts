import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

const debugOrErrorFilter = winston.format((info) => {
  return (info.level === 'debug' || info.level === 'error') ? info : false;
})();

export const winstonLoggerConfig = {
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        debugOrErrorFilter,
        winston.format.timestamp(),
        nestWinstonModuleUtilities.format.nestLike(
          'build-operatorai',
          {
            prettyPrint: true,
          },
        ),
      ),
    }),
  ],
}; 