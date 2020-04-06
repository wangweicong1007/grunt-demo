function roundFractional(x, n) {
    return Math.round(x * Math.pow(10, n)) / Math.pow(10, n);
  }

$(function() {
    // get dom elem
    var $width=$('#width'),
    $height=$('#height'),
    $btnCal=$('#calculate'),
    $perimeter=$('#perimeter'),
    $area=$('#area');
    /*calc button click event */
    $btnCal.click(function(){
        // get value
        var w=Number($width.val()),
        h=Number($height.val());

        // caculate
        // var p=2*(roundFractional(w+h, 16)),
        // a=roundFractional(w*h, 16);
        var rect=rectangle();

        // output
        $perimeter.val(rect.perimeter(w,h));
        $area.val(rect.area(w,h));

    })
})