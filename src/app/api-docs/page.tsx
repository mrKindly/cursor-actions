"use client";

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocs() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto py-12 px-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-indigo-600 mb-8 font-headline">API Documentation</h1>
        <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <SwaggerUI url="/api/swagger" />
        </div>
      </div>
    </div>
  );
}
