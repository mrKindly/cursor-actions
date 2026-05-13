import { createSwaggerSpec } from 'next-swagger-doc';

export const getApiDocs = async () => {
  const spec = createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'WanderSync Experience API',
        version: '1.0.0',
        description: 'API for accessing WanderSync coastal boat trip experiences and details.',
      },
      servers: [
        {
          url: '/',
          description: 'Local server',
        },
      ],
      components: {
        securitySchemes: {},
      },
      security: [],
    },
  });
  return spec;
};
