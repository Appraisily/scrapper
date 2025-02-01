class ResponseAnalyzer {
  analyzeStructure(obj, path = '') {
    const structure = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        structure[key] = this.analyzeArray(value, currentPath);
      } else if (value && typeof value === 'object') {
        structure[key] = this.analyzeObject(value, currentPath);
      } else {
        structure[key] = this.analyzePrimitive(value, currentPath);
      }
    }
    
    return structure;
  }

  analyzeArray(arr, path) {
    const result = {
      type: 'array',
      length: arr.length,
      sample: arr.length > 0 ? typeof arr[0] : null,
      path
    };

    if (arr.length > 0 && typeof arr[0] === 'object') {
      result.itemStructure = this.analyzeStructure(arr[0], path + '[0]');
    }

    return result;
  }

  analyzeObject(obj, path) {
    return {
      type: 'object',
      fields: this.analyzeStructure(obj, path),
      path
    };
  }

  analyzePrimitive(value, path) {
    return {
      type: typeof value,
      value,
      path
    };
  }
}

module.exports = ResponseAnalyzer;