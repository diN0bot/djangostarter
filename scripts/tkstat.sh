#!/bin/sh

IFS=`echo -en "\n\b"`
for LINE in `svn stat`
do
  TYPE=`echo $LINE | awk '{print $1;}'`
  FILE=`echo $LINE | awk '{print $2;}'`
  echo $LINE
  if [[ "$TYPE" == "M" ]]
  then tkdiff $FILE
  fi
done
