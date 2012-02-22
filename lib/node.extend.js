/*!
 * node.extend
 * Copyright 2011, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * @fileoverview
 * Port of jQuery.extend that actually works on node.js
 */
function isPlainObject( obj ){
  var has_own_constructor, has_is_property_of_method, key;
  
  if( !obj || {}.toString.call( obj ) !== '[object Object]' || obj.nodeType || obj.setInterval ){
    return false;
  }

  has_own_constructor       = hasOwnProperty.call( obj, 'constructor' );
  has_is_property_of_method = hasOwnProperty.call( obj.constructor.prototype, 'isPrototypeOf' );
  
  // Not own constructor property must be Object
  if( obj.constructor && !has_own_constructor && !has_is_property_of_method ){
    return false;
  }

  // Own properties are enumerated firstly, so to speed up,
  // if last one is own, then all properties are own.
  for( key in obj ){}

  return key === undefined || hasOwnProperty.call( obj, key );
};

function extend () {
  var options, name, src, copy, copyIsArray, clone;
  var target = arguments[ 0 ] || {};
  var i      = 1;
  var length = arguments.length;
  var deep   = false;

  // Handle a deep copy situation
  if( typeof target === 'boolean' ){
    deep   = target;
    target = arguments[ 1 ] || {};
    // skip the boolean and the target
    i = 2;
  }

  // Handle case when target is a string or something (possible in deep copy)
  if( typeof target !== 'object' && typeof target !== 'function' ){
    target = {};
  }

  // extend jQuery itself if only one argument is passed
  if( length === i ){
    target = this;
    --i;
  }

  for( ; i < length; i++ ){
    // Only deal with non-null/undefined values
    if(( options = arguments[ i ]) != null ){
      // Extend the base object
      for( name in options ){
        src  = target[ name ];
        copy = options[ name ];

        // Prevent never-ending loop
        if( target === copy ){
          continue;
        }

        // Recurse if we're merging plain objects or arrays
        if( deep && copy && ( isPlainObject( copy ) || ( copyIsArray = Array.isArray( copy )))){
          if( copyIsArray ){
            copyIsArray = false;
            clone = src && Array.isArray( src ) ? src : [];
          } else {
            clone = src && isPlainObject( src ) ? src : {};
          }

          // Never move original objects, clone them
          target[ name ] = extend( deep, clone, copy );

        // Don't bring in undefined values
        }else if( copy !== undefined ){
          target[ name ] = copy;
        }
      }
    }
  }

  // Return the modified object
  return target;
};



extend.version = '0.0.2';



module.exports = extend;