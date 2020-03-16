$(function(){
    // console.log('hello worldd!')


    /**calc button click event */
    //get dom elem
    var $width = $('#width'),
        $height = $('#height'),
        $btnCal = $('#calculate'),
        $perimeter = $("#perimeter"),
        $area = $("#area");

    $btnCal.click(function(){
        //get value
        var w = Number($width.val()) ,
            h = Number($height.val());

        //calculate
        var p = (2*(w+h)).toFixed(3),
            a=(w*h).toFixed(3);

        //output
        $perimeter.val(p);
        $area.val(a);

    });
    
})
