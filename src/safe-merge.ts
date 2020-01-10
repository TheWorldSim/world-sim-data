// source: https://gist.github.com/AJamesPhillips/4b36d407d2824d8ba114a96122fd312f
// awaiting answer from: https://stackoverflow.com/questions/59684256/type-safe-object-merge-in-typescript

// type UniqueObject<T, U> = { [K in keyof U]: K extends keyof T ? never : U[K] }

// export function safe_merge <T, U, V, W, X, Y, Z> (
//   a: T,
//   b?: UniqueObject<T, U>,
//   c?: UniqueObject<T & U, V>,
//   d?: UniqueObject<T & U & V, W>,
//   e?: UniqueObject<T & U & V & W, X>,
//   f?: UniqueObject<T & U & V & W & X, Y>,
//   g?: UniqueObject<T & U & V & W & X & Y, Z>,
// ) {
//   return {
//     ...a,
//     ...b,
//     ...c,
//     ...d,
//     ...e,
//     ...f,
//     ...g,
//   }
// }

export function safe_merge (...objects: object[])
{
  const merge_result: {[index: string]: any} = {}
  const duplicate_keys: string[] = []

  objects.forEach(dict => {
    Object.keys(dict)
      .forEach(key => {
        const obj = (dict as any)[key]
        if (merge_result[key]) 
        {
          duplicate_keys.push(key)
          return
        }
        merge_result[key] = obj
      })
  })

  if (duplicate_keys.length)
  {
    const spacer = "\n * "
    throw new Error("Duplicate keys:" + spacer + duplicate_keys.join(spacer) + "\n")
  }

  return merge_result
}
